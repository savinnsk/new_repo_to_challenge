import { pathToFileURL } from "node:url";
import { run } from "./common.mjs";

export async function build() {
  console.log(
    "Instalando dependências do lockfile, incluindo ferramentas de build…",
  );
  await run("npm", ["ci", "--include=dev"]);
  console.log("Gerando build de produção da API e do Next.js…");
  await run("npm", ["run", "build"]);
  console.log("Build concluído. Para iniciar: node script/start.mjs");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await build();
}
