use mongodb::bson::{doc, Document};
use mongodb::options::IndexOptions;
use mongodb::IndexModel;
use mongodb::{Client, Database};

use crate::config::Config;

pub async fn connect(config: &Config) -> mongodb::error::Result<Database> {
    let client = Client::with_uri_str(&config.mongodb_uri).await?;
    let db = client.database(&config.mongodb_db);
    // Fail fast with a clear error when MongoDB is unreachable.
    db.run_command(doc! { "ping": 1 }).await?;
    Ok(db)
}

/// Create every index the API relies on. Safe to call on each boot: MongoDB
/// only creates the indexes that are missing.
pub async fn ensure_indexes(db: &Database) -> mongodb::error::Result<()> {
    unique_index(db, "users", "username").await?;
    unique_index(db, "pages", "slug").await?;
    unique_index(db, "layout", "slug").await?;
    unique_index(db, "docs", "path").await?;
    unique_index(db, "i18n", "code").await?;

    let docs = db.collection::<Document>("docs");
    let docs_parent_index = IndexModel::builder()
        .keys(doc! { "parentId": 1, "order": 1 })
        .build();
    docs.create_indexes(vec![docs_parent_index]).await?;

    let contacts = db.collection::<Document>("contacts");
    let created_index = IndexModel::builder().keys(doc! { "createdAt": -1 }).build();
    contacts.create_indexes(vec![created_index]).await?;

    Ok(())
}

async fn unique_index(db: &Database, collection: &str, field: &str) -> mongodb::error::Result<()> {
    let options = IndexOptions::builder().unique(true).build();
    let model = IndexModel::builder()
        .keys(doc! { field: 1 })
        .options(options)
        .build();
    db.collection::<Document>(collection)
        .create_indexes(vec![model])
        .await?;
    Ok(())
}
