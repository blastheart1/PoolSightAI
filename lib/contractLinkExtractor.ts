import { load } from "cheerio";
import type { Element } from "domhandler";
import type { ParsedEmail } from "./emlParser";
import { validateAddendumUrl } from "./addendumParser";

export interface ExtractedContractLinks {
  originalContractUrl: string | null;
  addendumUrls: string[];
  links?: Array<{ url: string }>;
}

function extractProDBXUrlFromTracking(trackingUrl: string): string | null {
  try {
    const decoded = decodeURIComponent(trackingUrl);
    const prodbxMatch = decoded.match(
      /https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?[^\s\/"<>\n\r]+/i
    );
    if (prodbxMatch) return prodbxMatch[0];
    const encodedMatch = trackingUrl.match(
      /l1\.prodbx\.com%2Fgo%2Fview%2F%3F([^%\/]+)/i
    );
    if (encodedMatch) {
      const urlId = encodedMatch[1];
      try {
        return `https://l1.prodbx.com/go/view/?${decodeURIComponent(urlId)}`;
      } catch {
        return `https://l1.prodbx.com/go/view/?${urlId}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function extractUrlsFromText(text: string): string[] {
  const urls: string[] = [];
  const directUrlPattern =
    /https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?[^\s"<>\n\r]+/gi;
  const directMatches = text.match(directUrlPattern);
  if (directMatches) {
    directMatches.forEach((url) => {
      const cleanUrl = url.replace(/[.,;!?]+$/, "");
      if (validateAddendumUrl(cleanUrl)) urls.push(cleanUrl);
    });
  }
  const trackingUrlPattern = /https?:\/\/track\.pstmrk\.it\/[^\s"<>]+/gi;
  const trackingMatches = text.match(trackingUrlPattern);
  if (trackingMatches) {
    trackingMatches.forEach((trackingUrl) => {
      const prodbxUrl = extractProDBXUrlFromTracking(trackingUrl);
      if (prodbxUrl && validateAddendumUrl(prodbxUrl)) urls.push(prodbxUrl);
    });
  }
  return Array.from(new Set(urls));
}

function extractUrlFromLink($: ReturnType<typeof load>, link: unknown): string | null {
  const $link = $(link as Element);
  const href = $link.attr("href");
  const linkText = $link.text().trim();
  if (href && validateAddendumUrl(href)) return href;
  if (linkText) {
    const urlMatch = linkText.match(
      /https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?[^\s"<>\n\r]+/i
    );
    if (urlMatch) {
      const extracted = urlMatch[0].replace(/[.,;!?]+$/, "");
      if (validateAddendumUrl(extracted)) return extracted;
    }
  }
  if (href?.includes("aHR0cHM6Ly9sMS5wcm9kYnguY29t")) {
    try {
      const base64Match = href.match(/[^-]+-([^/]+)/);
      if (base64Match?.[1]) {
        const urlDecoded = decodeURIComponent(base64Match[1]);
        const decodedUrl = Buffer.from(urlDecoded, "base64").toString("utf-8");
        const match = decodedUrl.match(
          /https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?[^\s"<>\n\r]+/i
        );
        if (match) {
          const extracted = match[0].replace(/[.,;!?]+$/, "");
          if (validateAddendumUrl(extracted)) return extracted;
        }
      }
    } catch {
      // ignore
    }
  }
  if (href) {
    const extracted = extractProDBXUrlFromTracking(href);
    if (extracted && validateAddendumUrl(extracted)) return extracted;
  }
  return null;
}

function extractOriginalContractUrlFromHTML($: ReturnType<typeof load>): string | null {
  const originalContractSection = $("strong").filter((_i, el) => {
    return $(el).text().toLowerCase().includes("original contract");
  });
  if (originalContractSection.length === 0) return null;

  const parent = originalContractSection.parent();
  let link = parent.find('a[href*="prodbx.com"]').first();

  if (link.length === 0) {
    const parentDiv = originalContractSection.closest("div");
    if (parentDiv.length > 0) {
      const nextSibling = parentDiv.next("div");
      if (nextSibling.length > 0) {
        const allLinks = nextSibling.find('a[href*="prodbx.com"]');
        allLinks.each((_i, el) => {
          const $linkEl = $(el);
          if ($linkEl.text().trim().length > 0 && link.length === 0) {
            link = $linkEl;
            return false;
          }
        });
        if (link.length === 0 && allLinks.length > 0) {
          link = $(allLinks[0]);
        }
      }
    }
  }

  if (link.length === 0) {
    const allDivs = $("div");
    let foundSection = false;
    allDivs.each((_i, div) => {
      const $div = $(div);
      if (!foundSection) {
        if (
          $div.find("strong").filter((_idx, el) =>
            $(el).text().toLowerCase().includes("original contract")
          ).length > 0
        ) {
          foundSection = true;
        }
      } else {
        const divLinks = $div.find('a[href*="prodbx.com"]');
        if (divLinks.length > 0 && link.length === 0) {
          divLinks.each((_idx, el) => {
            const $linkEl = $(el);
            if ($linkEl.text().trim().length > 0 && link.length === 0) {
              link = $linkEl;
              return false;
            }
          });
          if (link.length === 0) link = $(divLinks[0]);
        }
      }
    });
  }

  if (link.length > 0) {
    const extracted = extractUrlFromLink($, link[0]);
    if (extracted) return extracted;
  }
  return null;
}

function extractAddendumUrlsFromHTML($: ReturnType<typeof load>): string[] {
  const addendumUrls: string[] = [];
  const addendumsSection = $("strong").filter((_i, el) => {
    return $(el).text().toLowerCase().includes("addendums");
  });
  if (addendumsSection.length === 0) return addendumUrls;

  let links = addendumsSection.parent().find('a[href*="prodbx.com"]');
  if (links.length === 0) {
    const parentDiv = addendumsSection.closest("div");
    if (parentDiv.length > 0) {
      let nextSibling = parentDiv.next("div");
      while (nextSibling.length > 0 && links.length === 0) {
        links = nextSibling.find('a[href*="prodbx.com"]');
        if (links.length === 0) nextSibling = nextSibling.next("div");
        else break;
      }
    }
  }

  if (links.length === 0) {
    const allDivs = $("div");
    let foundSection = false;
    allDivs.each((_i, div) => {
      const $div = $(div);
      if (!foundSection) {
        if (
          $div.find("strong").filter((_idx, el) =>
            $(el).text().toLowerCase().includes("addendums")
          ).length > 0
        ) {
          foundSection = true;
        }
      } else {
        $div.find('a[href*="prodbx.com"]').each((_idx, linkEl) => {
          const extracted = extractUrlFromLink($, linkEl);
          if (extracted) addendumUrls.push(extracted);
        });
      }
    });
  } else {
    links.each((_i, el) => {
      const extracted = extractUrlFromLink($, el);
      if (extracted) addendumUrls.push(extracted);
    });
  }
  return addendumUrls;
}

export function extractContractLinks(
  parsedEmail: ParsedEmail
): ExtractedContractLinks {
  const result: ExtractedContractLinks = {
    originalContractUrl: null,
    addendumUrls: [],
    links: [],
  };

  if (parsedEmail.html) {
    try {
      const $ = load(parsedEmail.html);
      result.originalContractUrl = extractOriginalContractUrlFromHTML($);
      result.addendumUrls = extractAddendumUrlsFromHTML($);
    } catch (error) {
      console.warn("[Contract Link Extractor] Error parsing HTML:", error);
    }
  }

  if (
    !result.originalContractUrl &&
    result.addendumUrls.length === 0 &&
    parsedEmail.text
  ) {
    try {
      const text = parsedEmail.text;
      const originalContractMatch = text.match(
        /Original\s+Contract\s*:?\s*([^\n]+)/i
      );
      if (originalContractMatch) {
        const urls = extractUrlsFromText(originalContractMatch[1]);
        if (urls.length > 0) result.originalContractUrl = urls[0];
      }
      const addendumsMatch = text.match(
        /Addendums\s*:?\s*([\s\S]+?)(?=\n\n|\n[A-Z]|$)/i
      );
      if (addendumsMatch) {
        result.addendumUrls.push(...extractUrlsFromText(addendumsMatch[1]));
      }
    } catch (error) {
      console.warn("[Contract Link Extractor] Error parsing text:", error);
    }
  }

  try {
    const text = parsedEmail.html || parsedEmail.text || "";
    result.links = Array.from(new Set(extractUrlsFromText(text))).map((url) => ({
      url,
    }));
  } catch {
    // continue without links array
  }

  if (result.originalContractUrl) {
    result.addendumUrls = result.addendumUrls.filter(
      (url) => url !== result.originalContractUrl
    );
  }
  result.addendumUrls = Array.from(new Set(result.addendumUrls));
  return result;
}
