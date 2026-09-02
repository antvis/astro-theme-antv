import { defineCollection } from "astro:content";
import {
  antvDocsLoader,
  antvDocsSchema,
} from "../../../dist/content.js";

export const collections = {
  docs: defineCollection({
    loader: antvDocsLoader({ base: "./docs" }),
    schema: antvDocsSchema,
  }),
};
