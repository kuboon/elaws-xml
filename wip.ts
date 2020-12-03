#!/bin/env -S deno run --unstable --allow-net=elaws.e-gov.go.jp --allow-run=unzip --allow-read --allow-write
import { fromStreamReader } from "https://deno.land/std@0.77.0/io/mod.ts";

const ZipFileName = "xml_all.zip";
async function getZip() {
  const res = await fetch(
    "https://elaws.e-gov.go.jp/download?file_section=1&only_xml_flag=true",
  );
  if (res.status != 200) throw res;
  const file = await Deno.open(ZipFileName, { create: true, write: true });
  const reader = fromStreamReader(res.body!.getReader());
  await Deno.copy(reader, file).then(() => file.close());
}
async function main() {
  //await getZip()
  await Deno.run(
    {
      cmd: ["unzip", "-j", "-o", ZipFileName, "-d", "docs/xml"],
    },
  ).status()
}
await main();
