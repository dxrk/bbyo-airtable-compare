// Check if parent ID already exists in airtable as parent 1 or parent 2
const parents = [
  {
    name: matchingAirtableRecord.get("Parent 1 Name"),
    id: parseInt(matchingAirtableRecord.get("Parent 1 MyBBYO ID")),
  },
  {
    name: matchingAirtableRecord.get("Parent 2 Name"),
    id: parseInt(matchingAirtableRecord.get("Parent 2 MyBBYO ID")),
  },
];

// check if parent ID or name already exists in airtable as parent 1 or parent 2
const parentExists = parents.some(
  (parent) =>
    parent.id == parseInt(csvRecord[field[0]]) ||
    parent.name == csvRecord[field[0]]
);
// If it doesn't alredy exist, add it
if (!parentExists) {
  console.log("Parent doesn't exist");
  console.log(parents);
  console.log(csvRecord[field[0]]);
  console.log("-----------------------------");

  updatedRecord.fields[field[1]] = csvRecord[field[0]];
}
