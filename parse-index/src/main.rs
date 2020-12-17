use encoding_rs;
use std::fs;
use std::process;
use std::io::Write;
use std::error::Error;
use serde::{Serialize, Deserialize};

#[derive(Debug, Deserialize)]
struct Record {
    typ: String,
    law_num: String,
    name: String,
    kana: String,
    old_n: String,
    publish_on: String,
    new_name: String,
    new_num: String,
    new_publish_on: String,
    apply_on: String,
    note: String,
    id: String,
    url: String,
    etc1: String,
    etc2: String
}

#[derive(Debug, Serialize)]
struct Out {
    typ: String,
    law_num: String,
    name: String,
    publish_on: String,
    id: String,
    url: String,
    file: String
}

fn parse(text: &[u8]) -> Result<(), Box<dyn Error>> {
    let mut v: Vec<Out> = Vec::new();
    let mut rdr = csv::ReaderBuilder::new()
    .has_headers(false).from_reader(text);
    for result in rdr.deserialize() {
        // Notice that we need to provide a type hint for automatic
        // deserialization.
        let r: Record = result?;
        let url = r.url.clone();
        match url.find("=") {
            None => eprintln!("{}", url),
            Some(pos) => {
                let file = &url[pos+1..];
                let o: Out = Out{
                    typ: r.typ,
                    law_num: r.law_num,
                    name: r.name,
                    publish_on: r.publish_on,
                    id: r.id,
                    url: r.url,
                    file: file.to_string()
                };
                v.push(o);
            }
        }
    }
    let j = serde_json::to_string(&v)?;
    println!("{}", j);
    Ok(())
}


fn main() {
    let path = "../docs/all_law_list.csv";
    let s = fs::read(path).unwrap();
    let (res, _, _) = encoding_rs::SHIFT_JIS.decode(&s);
    let text = res.into_owned();

    if let Err(err) = parse(text.as_bytes()) {
        println!("error on parse {}", err);
        process::exit(1)
    }

    let mut file = fs::File::create("../docs/index.json").unwrap();
    file.write(text.as_bytes()).unwrap();
}