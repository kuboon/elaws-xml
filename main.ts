#!/bin/env -S deno run --unstable --allow-net=elaws.e-gov.go.jp --allow-run=unzip --allow-read --allow-write
import {
  fromStreamReader,
  fromStreamWriter,
} from "https://deno.land/std@0.77.0/io/mod.ts";
import { walk } from "https://deno.land/std@0.77.0/fs/mod.ts";
import { SAXParser } from "https://deno.land/x/sax_ts@v1.2.10/src/sax.ts";
import { readLines } from "https://deno.land/std@0.77.0/io/bufio.ts";

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
async function unzip() {
  await Deno.run(
    {
      cmd: ["unzip", "-j", "-o", ZipFileName, "-d", "docs/xml"],
    },
  ).status();
}

const Nop = () => undefined;
function parserFactory(ret: any) {
  const parser = new SAXParser(true, {});
  const tagopen = (tag: any) => {
    switch (tag.name) {
      case "LawNum":
        parser.ontext = (text: string) => {
          ret["name"] = text;
          parser.ontext = Nop;
        };
        break;
      case "LawTitle":
        parser.ontext = (text: string) => {
          ret["title"] = text;
          parser.ontext = Nop;
          parser.onopentag = Nop;
          parser.close();
        };
        break;
    }
  };
  parser.onerror = function (e: any) {
    // an error happened.
    console.error(e);
  };
  parser.onopentag = tagopen;
  return parser;
}
async function buildIndex() {
  const index: any = {};
  for await (const entry of walk("docs/xml")) {
    if (entry.isDirectory) continue;
    const props: any = {};
    const parser = parserFactory(props);
    const file = await Deno.open(entry.path, { read: true });
    for await (let line of readLines(file)) {
      parser.write(line);
    }
    file.close();
    console.log(entry.path);
    if (!props.name) Deno.exit(1);
    index[props.name] = {
      name: entry.name,
      title: props.title,
    };
  }
  return index;
}
function buildHtml(index: any) {
  const encoder = new TextEncoder();
  const st = new ReadableStream({
    start(controller) {
      for (const [k, v] of Object.entries<any>(index)) {
        const str = `<a href='xml/${v.name}'>${k} ${v.title}</a><br />\n`;
        controller.enqueue(encoder.encode(str));
      }
      controller.close();
      console.log("done");
    },
  });
  return fromStreamReader(st.getReader());
}
async function index() {
  let index: any;
  let res = await Deno.permissions.request(
    { name: "write", path: "docs/index.json" },
  );
  if (res.state === "granted") {
    index = buildIndex();
    Deno.writeTextFileSync("docs/index.json", JSON.stringify(index));
  } else {
    await Deno.permissions.request(
      { name: "read", path: "docs/index.json" },
    );
    index = JSON.parse(Deno.readTextFileSync("docs/index.json"));
  }
  res = await Deno.permissions.request(
    { name: "write", path: "docs/index.html" },
  );
  if (res.state === "granted") {
    const html = await Deno.open(
      "docs/index.html",
      { create: true, write: true },
    );
    await Deno.copy(buildHtml(index), html);
    html.close();
  }
}
await getZip()
await unzip()
//await index();
