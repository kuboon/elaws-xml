import { walk } from "https://deno.land/std@0.77.0/fs/mod.ts";
import { SAXParser } from "https://deno.land/x/sax_ts@v1.2.10/src/sax.ts";
import {
  fromStreamReader,
  fromStreamWriter,
} from "https://deno.land/std/io/mod.ts";

const Nop = () => undefined;
function parserFactory(ret: any) {
  const decoder = new TextDecoder("utf-8");
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
  const st = new WritableStream({
    write(chunk): void {
      const decoded = decoder.decode(chunk);
      parser.write(decoded);
    },
    close() {
      parser.close();
    },
  });
  return fromStreamWriter(st.getWriter());
}
async function buildIndex() {
  const index: any = {};
  for await (const entry of walk("../xml")) {
    if (entry.isDirectory) continue;
    const file = await Deno.open(entry.path, { read: true });
    const props: any = {};
    console.log(entry.path);
    await Deno.copy(file, parserFactory(props));
    file.close();
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
        const str = `<a href='xml/${v.name}'>${k} ${v.title}</a>`;
        controller.enqueue(encoder.encode(str));
      }
      controller.close();
      console.log("done");
    },
  });
  return fromStreamReader(st.getReader());
}
// const index = buildIndex();
// Deno.writeTextFileSync("../index.json", JSON.stringify(index));
const index = JSON.parse(Deno.readTextFileSync("../index.json"));
const html = await Deno.open("../index.html", { create: true, write: true });
await Deno.copy(buildHtml(index), html);
html.close();
