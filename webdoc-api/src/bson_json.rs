use mongodb::bson::{Bson, Document};
use serde_json::{Map, Number, Value};

/// Convert a BSON value into a JSON value. Used for content that is stored as
/// free-form BSON (homepage layout sections) instead of a typed struct.
pub fn bson_to_json(value: Bson) -> Value {
    match value {
        Bson::Double(v) => Number::from_f64(v)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        Bson::String(v) => Value::String(v),
        Bson::Array(values) => Value::Array(values.into_iter().map(bson_to_json).collect()),
        Bson::Document(doc) => document_to_json(&doc),
        Bson::Boolean(v) => Value::Bool(v),
        Bson::Null | Bson::Undefined | Bson::DbPointer(_) => Value::Null,
        Bson::RegularExpression(regex) => {
            Value::String(format!("/{}/{}", regex.pattern, regex.options))
        }
        Bson::JavaScriptCode(code) | Bson::Symbol(code) => Value::String(code),
        Bson::JavaScriptCodeWithScope(code) => Value::String(code.code),
        Bson::Int32(v) => Value::Number(v.into()),
        Bson::Int64(v) => Value::Number(v.into()),
        Bson::Timestamp(ts) => Value::Number(ts.time.into()),
        Bson::Binary(binary) => Value::String(format!("binary:{:?}", binary.subtype)),
        Bson::ObjectId(oid) => Value::String(oid.to_hex()),
        Bson::DateTime(dt) => Value::String(dt.try_to_rfc3339_string().unwrap_or_default()),
        Bson::Decimal128(decimal) => Value::String(decimal.to_string()),
        Bson::MaxKey | Bson::MinKey => Value::Null,
    }
}

pub fn document_to_json(doc: &Document) -> Value {
    let mut map = Map::with_capacity(doc.len());
    for (key, value) in doc {
        map.insert(key.clone(), bson_to_json(value.clone()));
    }
    Value::Object(map)
}

/// Convert parsed JSON into BSON for storage.
pub fn json_to_bson(value: Value) -> Bson {
    match value {
        Value::Null => Bson::Null,
        Value::Bool(v) => Bson::Boolean(v),
        Value::Number(number) => {
            if let Some(v) = number.as_i64() {
                Bson::Int64(v)
            } else if let Some(v) = number.as_u64() {
                Bson::Int64(v as i64)
            } else {
                Bson::Double(number.as_f64().unwrap_or_default())
            }
        }
        Value::String(v) => Bson::String(v),
        Value::Array(values) => Bson::Array(values.into_iter().map(json_to_bson).collect()),
        Value::Object(map) => {
            let mut doc = Document::new();
            for (key, value) in map {
                doc.insert(key, json_to_bson(value));
            }
            Bson::Document(doc)
        }
    }
}
