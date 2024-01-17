import { ConfigSchema } from "./schema";

export function createDefaultConfig(): ConfigSchema {
  return {
    version: 1,
    languages: { source: 'en', target: ['es', 'fr'] },
    projects: [
      { name: 'demo', dictionary: 'demo/[lang].json' },
    ],
  };
}
