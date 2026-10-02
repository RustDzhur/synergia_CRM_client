// Сверка: сколько документов в MongoDB и сколько строк в соответствующих таблицах PostgreSQL.
import fs from "node:fs";
import mongoose from "mongoose";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const mongoUri = env.match(/^MONGODB_URI=(.*)$/m)[1].trim();
const pgUrl = env.match(/^DATABASE_URL=(.*)$/m)[1].trim();

const COLLECTIONS = ["ailogs","aiusages","assets","auditlogs","automationjobs","bankaccounts","banktransactions","blogposts","boms","companies","contacts","contactmessages","contracts","conversations","cryptopayments","deals","docfolders","docitems","documenttemplates","employees","events","expenses","feedposts","financesettings","fiscalshifts","importbatches","importmappings","integrations","invitations","invoices","invoicerequests","mailmessages","memberships","messages","notifications","orders","organizations","platformsettings","products","productionorders","projects","purchaseorders","quotes","recurringinvoices","sectionrecords","sharelinks","stages","stockdocs","stockmovements","suppliers","supplierinvoices","tasks","users","warehouses"];

await mongoose.connect(mongoUri);
const db = mongoose.connection.db;
const client = new pg.Client({ connectionString: pgUrl });
await client.connect();

let same = 0, diff = 0, missing = 0;
const diffs = [];
for (const c of COLLECTIONS) {
    const mongoCount = await db.collection(c).countDocuments();
    let pgCount = null;
    try { pgCount = Number((await client.query(`select count(*)::int n from "${c}"`)).rows[0].n); } catch { missing++; continue; }
    if (mongoCount === pgCount) same++;
    else { diff++; diffs.push(`${c}: mongo ${mongoCount} / postgres ${pgCount}`); }
}
console.log(`Совпадает таблиц: ${same}`);
console.log(`Расходится: ${diff}`);
if (diffs.length) diffs.forEach((d) => console.log("  " + d));
console.log(`Нет таблицы в Postgres: ${missing}`);
await client.end();
await mongoose.disconnect();
