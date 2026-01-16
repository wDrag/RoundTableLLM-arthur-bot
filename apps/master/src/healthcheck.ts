const response = await fetch("http://localhost:8787/health");
if (!response.ok) {
  process.exit(1);
}
const data = await response.json();
if (!data?.ok) {
  process.exit(1);
}
process.exit(0);
