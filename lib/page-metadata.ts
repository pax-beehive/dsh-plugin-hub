import type { Metadata } from "next";
import { absoluteUrl, MARKDOWN_HOME } from "./site-url.ts";

type PageMetadataInput = {
  path: string;
  title: string;
  description: string;
  index?: boolean;
  images?: NonNullable<Metadata["openGraph"]>["images"];
  markdownAlternate?: string;
};

export function pageMetadata(input: PageMetadataInput): Metadata {
  const url = absoluteUrl(input.path);
  const index = input.index ?? true;
  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: url,
      ...(input.markdownAlternate
        ? { types: { "text/markdown": input.markdownAlternate } }
        : {}),
    },
    robots: index
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : { index: false },
    openGraph: {
      url,
      title: input.title,
      description: input.description,
      ...(input.images ? { images: input.images } : {}),
    },
    twitter: {
      title: input.title,
      description: input.description,
      ...(input.images ? { images: twitterImages(input.images) } : {}),
    },
  };
}

export function homePageMetadata(input: {
  title: string;
  description: string;
}): Metadata {
  return pageMetadata({
    ...input,
    path: "/",
    markdownAlternate: MARKDOWN_HOME,
  });
}

export const notFoundMetadata: Metadata = {
  title: "Not found",
  robots: {
    index: false,
  },
};

function twitterImages(
  images: NonNullable<PageMetadataInput["images"]>,
): string[] {
  const list = Array.isArray(images) ? images : [images];
  return list.flatMap((image) => {
    if (typeof image === "string") return [image];
    if (image instanceof URL) return [image.toString()];
    if (typeof image === "object" && image && "url" in image) {
      return [typeof image.url === "string" ? image.url : image.url.toString()];
    }
    return [];
  });
}
