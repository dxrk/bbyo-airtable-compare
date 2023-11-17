/* TODO: Add to bxntal.com/utils/
   - Need to check how to pass NULL to airtable */

const express = require("express");
const http = require("http");
const multer = require("multer");
const streamifier = require("streamifier");
const csv = require("csv-parser");
const fs = require("fs");
const storageFile = require("./storage.json");

const Airtable = require("airtable");
const { send } = require("process");
Airtable.configure({
  endpointUrl: "https://api.airtable.com",
  apiKey: storageFile.apiKey,
});
const base = Airtable.base(storageFile.baseID);
const table = base("Leads");

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Host index.html
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Endpoint to process CSV
app.post("/process-csv", upload.single("csvFile"), async (req, res) => {
  try {
    const csvBuffer = req.file.buffer;
    const csvRecords = await parseCSVBuffer(csvBuffer);

    // Check the action from the request
    const action = req.body.action;

    if (action === "update") {
      const updatedRecords = await findUpdatedRecords(csvRecords);
      res.json({
        message: "CSV processed successfully",
        records: updatedRecords,
        totalRecords: storageFile.lastTotal,
      });
    } else if (action === "create") {
      const newRecords = await findNewRecords(csvRecords);
      res.json({
        message: "CSV processed successfully",
        records: newRecords,
        totalRecords: storageFile.lastTotal,
      });
    } else {
      res.status(400).json({ message: "Invalid action" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
});

// Endpoint to update airtable
app.post("/update-airtable", async (req, res) => {
  try {
    const updatedRecords = storageFile.updatedRecords;
    const newRecords = storageFile.newRecords;

    if (updatedRecords.length > 0) {
      for (let i = 0; i < updatedRecords.length; i += 10) {
        await table.update(updatedRecords.slice(i, i + 10));
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      res.json({
        message: `Airtable updated successfully for ${updatedRecords.length} records`,
        updatedRecords,
        totalRecords: storageFile.lastTotal,
      });
    } else if (newRecords.length > 0) {
      for (let i = 0; i < newRecords.length; i += 10) {
        await table.create(newRecords.slice(i, i + 10));
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      res.json({
        message: `Airtable updated successfully for ${newRecords.length} records`,
        newRecords,
        totalRecords: storageFile.lastTotal,
      });
    } else {
      res.status(400).json({ message: "No records to update" });
    }

    // Clear storage file
    storageFile.updatedRecords = [];
    storageFile.newRecords = [];
    fs.writeFileSync("./storage.json", JSON.stringify(storageFile));
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
});

// Endpoint to clear the storage file
app.post("/clear-storage", (req, res) => {
  try {
    storageFile.updatedRecords = [];
    storageFile.newRecords = [];
    fs.writeFileSync("./storage.json", JSON.stringify(storageFile));

    res.json({ message: "Storage cleared successfully!" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
});

// Function to read and parse a CSV buffer
function parseCSVBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];

    // Using streamifier to create a readable stream from the buffer
    const stream = streamifier.createReadStream(buffer).pipe(csv());

    stream
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

// Function to compare and generate updates
async function findUpdatedRecords(csvRecords, res) {
  try {
    // const airtableRecords = await table.select().firstPage();
    const airtableRecords = await table.select().all();
    const updatedRecords = [];

    csvRecords.forEach((csvRecord) => {
      const matchingAirtableRecord = airtableRecords.find(
        (airtableRecord) =>
          airtableRecord.get("myBBYO ID") === csvRecord["myBBYO ID"]
      );

      if (matchingAirtableRecord) {
        const fieldsToCompare = [
          ["Graduation Year", "Graduation Year", false],
          ["Address Line 1", "Address Line 1", false],
          ["Address Line 2", "Address Line 2", false],
          ["City", "City", false],
          ["State", "State", false],
          ["ZIP", "ZIP", false],
          ["High School", "High School", false],
          ["Phone", "Phone", false],
          ["Email", "Email", false],
          ["Instagram Handle", "Instagram Handle", false],
          ["Community", "Community", false],
          ["Chapter", "Chapter", false],
          ["Membership Join Date", "Membership Join Date Import", false],
          ["Order", "Order", false],
          ["Leadership History", "Leadership History", false],
          ["Total Events Attended", "Total Events Attended", false],
          ["IC Events Attended", "IC Events Attended", false],
          [
            "Regional Conventions Attended",
            "Regional Conventions Attended",
            false,
          ],
          [
            "IC/Summer Registration Launch Night",
            "IC/Summer Registration Launch Night",
            false,
          ],
          ["Summer Experience History", "Summer Experience History", false],
          ["Parent 1 MyBBYO ID", "Parent 1 MyBBYO ID", false],
          ["Parent 1 Name", "Parent 1 Name", false],
          ["Parent 2 MyBBYO ID", "Parent 2 MyBBYO ID", false],
          ["Parent 2 Name", "Parent 2 Name", false],
          ["Do Not Email", "Do Not Email", false],
          ["Do Not Call", "Do Not Call", false],
          ["Do Not Text", "Do Not Text", false],
          ["Do Not Email - Summer", "Do Not Email - Summer", false],
        ];

        const isDifferent = fieldsToCompare.some((field) => {
          const airtableValue = String(
            matchingAirtableRecord.get(field[1])
          ).replace(/\s/g, "");
          const csvValue = String(csvRecord[field[0]]).replace(/\s/g, "");

          if (
            (airtableValue === "undefined" && csvValue === "") ||
            airtableValue === csvValue
          ) {
            return false;
          } else {
            field[2] = true;
            return true;
          }
        });

        if (isDifferent) {
          const updatedRecord = {
            id: matchingAirtableRecord.getId(),
            fields: {},
          };

          fieldsToCompare.forEach((field) => {
            if (field[2]) {
              const listOfInts = [
                "Total Events Attended",
                "IC Events Attended",
                "Regional Conventions Attended",
                "IC/Summer Registration Launch Night",
                "Parent 1 MyBBYO ID",
                "Parent 2 MyBBYO ID",
              ];

              if (listOfInts.includes(field[0])) {
                updatedRecord.fields[field[1]] = parseInt(csvRecord[field[0]]);
              } else if (
                field[0] == "Leadership History" ||
                field[0] == "Summer Experience History"
              ) {
                updatedRecord.fields[field[1]] =
                  csvRecord[field[0]] == ""
                    ? []
                    : csvRecord[field[0]].split(",");
              } else {
                updatedRecord.fields[field[1]] =
                  csvRecord[field[0]] == "" ? [] : csvRecord[field[0]];
              }
            }
          });

          // Remove fields that are "" or undefined or []
          Object.keys(updatedRecord.fields).forEach(
            (key) =>
              (updatedRecord.fields[key] === "" ||
                updatedRecord.fields[key] === undefined ||
                updatedRecord.fields[key].length === 0 ||
                updatedRecord.fields[key] === null ||
                updatedRecord.fields[key] === NaN) &&
              delete updatedRecord.fields[key]
          );

          if (Object.keys(updatedRecord.fields).length !== 0) {
            updatedRecord.fields["Updated?"] = "Yes";
            updatedRecords.push(updatedRecord);
          } else {
          }
        }
      }
    });

    storageFile.updatedRecords = updatedRecords;

    console.log(airtableRecords.length);
    storageFile.lastTotal = airtableRecords.length;
    fs.writeFileSync("./storage.json", JSON.stringify(storageFile));

    return updatedRecords;
  } catch (error) {
    console.error("Error:", error);
  }
}

async function findNewRecords(csvRecords) {
  try {
    // Need to update this after the update function is done with the progress bar.
    const airtableRecords = await table.select().all();
    const newRecords = [];

    csvRecords.forEach((csvRecord) => {
      const matchingAirtableRecord = airtableRecords.find(
        (airtableRecord) =>
          airtableRecord.get("myBBYO ID") === csvRecord["myBBYO ID"]
      );

      if (!matchingAirtableRecord) {
        const newRecord = {
          fields: {
            "myBBYO ID": csvRecord["myBBYO ID"],
            Community: csvRecord["Community"],
            Chapter: csvRecord["Chapter"],
            Order: csvRecord["Order"],
            "Total Events Attended": parseInt(
              csvRecord["Total Events Attended"]
            ),
            "IC Events Attended": parseInt(csvRecord["IC Events Attended"]),
            "Regional Conventions Attended": parseInt(
              csvRecord["Regional Conventions Attended"]
            ),
            "IC/Summer Registration Launch Night": parseInt(
              csvRecord["IC/Summer Registration Launch Night"]
            ),
            "First Name": csvRecord["First Name"],
            "Last Name": csvRecord[Object.keys(csvRecord)[0]],
            "Graduation Year": csvRecord["Graduation Year"],
            "Address Line 1": csvRecord["Address Line 1"],
            City: csvRecord["City"],
            State: csvRecord["State"],
            ZIP: csvRecord["ZIP"],
            "High School": csvRecord["High School"],
            Phone: csvRecord["Phone"],
            Email: csvRecord["Email"],
            "Parent 1 MyBBYO ID": parseInt(csvRecord["Parent 1 MyBBYO ID"]),
            "Parent 1 Name": csvRecord["Parent 1 Name"],
            "Parent 2 MyBBYO ID": parseInt(csvRecord["Parent 2 MyBBYO ID"]),
            "Parent 2 Name": csvRecord["Parent 2 Name"],
            "Leadership History":
              csvRecord["Leadership History"] == ""
                ? []
                : csvRecord["Leadership History"].split(","),
            "Summer Experience History":
              csvRecord["Summer Experience History"] == ""
                ? []
                : csvRecord["Summer Experience History"].split(","),
            "Membership Join Date Import": csvRecord["Membership Join Date"],
          },
        };

        // Remove fields that are "" or undefined or []
        Object.keys(newRecord.fields).forEach(
          (key) =>
            (newRecord.fields[key] === "" ||
              newRecord.fields[key] === undefined ||
              newRecord.fields[key].length === 0 ||
              newRecord.fields[key] === null ||
              newRecord.fields[key] === NaN) &&
            delete newRecord.fields[key]
        );

        newRecord.fields["Updated?"] = "Yes";
        newRecords.push(newRecord);
      }
    });

    // Update storage with new records
    storageFile.newRecords = newRecords;
    storageFile.lastTotal = airtableRecords.length;
    fs.writeFileSync("./storage.json", JSON.stringify(storageFile));

    return newRecords;
  } catch (error) {
    console.error("Error:", error);
  }
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
