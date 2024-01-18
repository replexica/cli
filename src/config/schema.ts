import { z } from 'zod';

const supportedLanguages = z.enum(['en', 'es', 'ca', 'fr', 'de', 'ja', 'ko', 'zh-CN']);

const languageSchema = z.object({
  source: supportedLanguages,
  target: z.array(supportedLanguages).transform((val) => {
    if (val.length === 0) {
      throw new Error('target languages must not be empty');
    }
    const uniqueTargetLangs = [...new Set(val)];
    if (uniqueTargetLangs.length !== val.length) {
      throw new Error('target languages must be unique');
    }
    return uniqueTargetLangs;
  }),
});

const projectSchema = z.object({
  name: z.string(),
  dictionary: z.string().transform((val) => {
    if (!val.includes('[lang]')) {
      throw new Error('dictionary pattern must contain "[lang]"');
    }
    if (!val.endsWith('.json')) {
      throw new Error('dictionary pattern must end with ".json"');
    }
    return val;
  }),
});

export const configSchema = z.object({
  version: z.literal(1),
  languages: languageSchema,
  projects: z.array(projectSchema),
});

export type ConfigSchema = z.infer<typeof configSchema>;
