declare namespace App {
  interface Locals {
    /** Set by posts/[slug].astro so MDX components know which post they are in. */
    post?: { slug: string; data: string };
  }
}
