import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Build Step 10 (planmysaas-blueprint/08-build-playbook.md): "Blog has at
// least one published post targeting a real search query from the problem
// clusters in 02-research.md" -- a normal Markdown content collection, no
// CMS, since this site is static-first with near-zero JS.
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
  }),
});

export const collections = { blog };
