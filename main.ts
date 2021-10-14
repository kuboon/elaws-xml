#!/bin/env -S deno run --unstable --allow-net=elaws.e-gov.go.jp --allow-run=unzip --allow-read --allow-write --import-map=import_map.json
import { readerFromStreamReader, readLines } from "std/io/mod.ts";
import { copy } from "std/streams/mod.ts";
import { walk } from "std/fs/mod.ts";
// import { readLines } from "std/io/bufio.ts";
import { SAXParser } from "https://raw.githubusercontent.com/kuboon/sax-ts/patch-1/src/sax.ts";

const ZipFileName = "xml_all.zip";

async function getZip() {
  const res = await fetch(
    "https://elaws.e-gov.go.jp/download?file_section=1&only_xml_flag=true",
  );
  if (res.status != 200) throw res;
  const file = await Deno.open(ZipFileName, { create: true, write: true });
  const reader = readerFromStreamReader(res.body!.getReader());
  await Deno.copy(reader, file).then(() => file.close());
}
async function unzip() {
  await Deno.run(
    {
      cmd: ["unzip", "-j", "-o", ZipFileName, "-d", "docs/xml"],
    },
  ).status();
}
async function rename() {
  Deno.chdir("docs/xml");
  for await (const entry of walk(".", {exts: ['xml']})) {
    const { path } = entry;
    const [name, ext] = path.split(".");
    const newpath = `${name.split("_")[0]}.${ext}`;
    if (path != newpath) await Deno.rename(path, newpath);
  }
  Deno.chdir("../..");
}
const Nop = () => undefined;
function parserFactory(ret: any) {
  const parser = new SAXParser(true, {});
  parser.done = false
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
          parser.done = true
        };
        break;
    }
  };
  parser.onerror = function (e: any) {
    throw e
  };
  parser.onopentag = tagopen;
  return parser;
}
async function buildIndex() {
  const index: any = {};
  for await (const entry of walk("docs/xml", {exts: ['xml']})) {
    if (entry.isDirectory) continue;
    const props: any = {};
    const parser = parserFactory(props);
    const file = await Deno.open(entry.path, { read: true });
    for await (let line of readLines(file)) {
      try {
        parser.write(line);
      } catch (e) {
        console.error('error on', entry.path)
        console.error(e);
        Deno.exit(1);
      }
      if(parser.done)break
    }
    file.close();
    // parser.close();
    console.log(entry.path);
    if (!props.name) {
      console.error("!props.name", props);
      Deno.exit(1);
    }
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
  return readerFromStreamReader(st.getReader());
}
async function index() {
  let index: any;
  let res = await Deno.permissions.request(
    { name: "write", path: "docs/index.json" },
  );
  if (res.state === "granted") {
    console.log("buildIndex");
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
    await copy(buildHtml(index), html);
    html.close();
  }
}
// await getZip()
// await unzip()
await rename();
await index();
