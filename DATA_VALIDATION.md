# Materials Data Checks

Keep the materials dataset reliable by running the lightweight validator whenever you edit `data/materials.json` or sync a new spreadsheet export.

## Quick Steps

1. Install dependencies if needed (Node.js ≥ 16).
2. From the project root run:

   ```bash
   node scripts/validateMaterials.js
   ```

3. Review the report:
   - **Errors** must be fixed before shipping updates.
   - **Warnings** highlight missing optional info (e.g. supplier links). Fill them in when possible.

Re-run the script after each significant data change so the front‑end always receives clean, predictable values.



