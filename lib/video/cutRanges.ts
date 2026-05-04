import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import type { TimeRange } from "@/lib/audio/silenceSegments";
export { invertRanges } from "@/lib/video/invertRanges";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);


/**
 * Returns the duration of an MP4 file in seconds using ffprobe.
 */
export function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      if (duration === undefined) return reject(new Error("Could not determine video duration"));
      resolve(duration);
    });
  });
}

/**
 * Cuts a video by removing the given time ranges and concatenating the kept segments.
 * Both video and audio tracks are preserved in kept segments.
 * Output is written to outputPath as MP4.
 */
export function cutVideoRanges(
  inputPath: string,
  outputPath: string,
  keepRanges: TimeRange[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (keepRanges.length === 0) {
      return reject(new Error("No keep ranges — all content would be removed"));
    }

    // Build filter_complex: trim each keep range for both video and audio streams,
    // reset PTS so segments concatenate seamlessly, then concat.
    const filterParts: string[] = [];
    const concatInputs: string[] = [];

    keepRanges.forEach(({ start, end }, i) => {
      filterParts.push(
        `[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${i}]`,
        `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${i}]`
      );
      concatInputs.push(`[v${i}][a${i}]`);
    });

    const n = keepRanges.length;
    filterParts.push(
      `${concatInputs.join("")}concat=n=${n}:v=1:a=1[outv][outa]`
    );

    const filterComplex = filterParts.join(";");

    ffmpeg(inputPath)
      .complexFilter(filterComplex)
      .outputOptions(["-map [outv]", "-map [outa]", "-movflags +faststart"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}
