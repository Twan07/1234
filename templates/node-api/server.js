import express from "express";

const app = express();
const port = Number(process.env.PORT || 4010);

app.get("/", (_req, res) => {
  res.json({
    message: "Hello from node-api template",
    time: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Template API listening on http://127.0.0.1:${port}`);
});
