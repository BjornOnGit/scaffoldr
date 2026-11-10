import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  blueprintManifestSchema,
  layerManifestSchema,
  lockFileSchema,
  moduleManifestSchema,
} from '@scaffoldr/schema';
import { z } from 'zod';

const outDir = fileURLToPath(new URL('../schema/', import.meta.url));

const schemas = {
  'layer.json': layerManifestSchema,
  'module.json': moduleManifestSchema,
  'blueprint.json': blueprintManifestSchema,
  'lock.json': lockFileSchema,
};

mkdirSync(outDir, { recursive: true });

for (const [fileName, schema] of Object.entries(schemas)) {
  // io: 'input' describes what authors write, so fields with defaults stay optional.
  const jsonSchema = z.toJSONSchema(schema, { io: 'input' });
  writeFileSync(
    `${outDir}${fileName}`,
    `${JSON.stringify(jsonSchema, null, 2)}\n`,
  );
  console.log(`wrote schema/${fileName}`);
}
