# Kotak Bank Statement Transaction Extractor

This code is designed to accurately extract transaction data from Kotak Mahindra Bank statements in PDF format. It is built as a Cloudflare Worker to provide an API endpoint for uploading a bank statement PDF and receiving structured transaction data in JSON format.

## Core Concepts

### `unpdf` Library

This code leverages the `unpdf` library for PDF parsing and text extraction. `unpdf` is an efficient JavaScript library that allows us to:

- **Process PDF documents:** Load and access the content of PDF files.
- **Extract text content:** Accurately extract text from PDF pages, preserving text order and structure to a reasonable extent.

### Transaction Table Structure

The code is designed to parse bank statements where transaction details are presented in a tabular format. It expects the table to have the following columns, identified by a header row:

- **DATE:** Transaction date (DD MMM, YYYY format).
- **TRANSACTION DETAILS:** Description of the transaction.
- **CHEQUE/REFERENCE#:** Cheque number or transaction reference number (can be empty).
- **DEBIT:** Debit amount for the transaction.
- **CREDIT:** Credit amount for the transaction.
- **BALANCE:** Account balance after the transaction.

### Parsing Logic

The code employs two key functions to achieve accurate transaction extraction:

- **`parseTransactionLine(line)`:** This function takes a single line of text (assumed to be a transaction row from the PDF) and attempts to parse it into a structured JavaScript object.

  - **Date Extraction:** It uses a regular expression to identify and extract the date at the beginning of the line.
  - **Description and Reference Separation:** It implements enhanced logic to separate the transaction description from the reference number, handling cases where they are not clearly delimited. It heuristically identifies reference numbers based on common prefixes like "UPI-", "FCM-", "IMPS-" or purely numeric patterns, assuming the last word in the "details" part that matches these patterns is the reference.
  - **Amount Extraction:** It uses a robust regular expression to find and extract debit, credit, and balance amounts from the end of the line, correctly handling comma separators and signs (+/-).
  - **Data Cleaning:** It cleans up the description and reference by trimming whitespace and removing extraneous characters.

- **`mergeTransactionLines(lines)`:** This function addresses the issue of transactions that span across multiple lines in the PDF.

  - **Line Grouping:** It iterates through an array of lines and groups consecutive lines that do _not_ start with a date into the same transaction entry.
  - **Merging:** It joins the lines within each group with a space, effectively merging multi-line transaction descriptions into a single line for parsing by `parseTransactionLine`.

- **`extractTransactions(dataBuffer)`:** This asynchronous function orchestrates the entire extraction process:
  - **PDF Loading:** It uses `getDocumentProxy` from `unpdf` to load the PDF data from a buffer.
  - **Text Extraction:** It extracts text content from each page of the PDF using `extractText`, keeping pages separate (`mergePages: false`).
  - **Table Boundary Detection:** It iterates through each page's text lines and searches for the `startKeyword` ("DATE TRANSACTION DETAILS...") to identify the beginning of a transaction table. It uses `endKeywords` (SUMMARY, Page , AP-Aut) to detect the end of each month's transaction table within combined statements.
  - **Line Filtering and Merging:** It filters out header and page number lines and then uses `mergeTransactionLines` to combine any multi-line transactions within each table.
  - **Parsing and Aggregation:** It maps each merged transaction line to `parseTransactionLine` to create structured transaction objects and aggregates these objects into the `allTransactions` array.
  - **Error Handling:** It includes a `try...catch` block to handle potential PDF parsing errors gracefully.

## Code Structure

- **`parseTransactionLine(line)`:** Parses a single transaction line into a JavaScript object.
- **`mergeTransactionLines(lines)`:** Merges multi-line transactions into single lines.
- **`extractTransactions(dataBuffer)`:** Main function to extract transactions from a PDF data buffer.
- **`export default { fetch(request, env, ctx) { ... } }`:** Cloudflare Worker `fetch` handler to create an API endpoint:
  - Handles `OPTIONS` requests for CORS preflight.
  - Handles `POST /upload` requests to receive PDF files.
  - Validates file type (`application/pdf`).
  - Calls `extractTransactions` to process the PDF.
  - Returns a JSON response with the extracted `transactions` or error messages.

## How to Use

### Cloudflare Workers Setup (Briefly)

1.  **Cloudflare Account:** You need a Cloudflare account and access to Cloudflare Workers.
2.  **Create a Worker:** Create a new Cloudflare Worker.
3.  **Deploy Code:** Copy and paste the provided JavaScript code into the Worker editor in the Cloudflare dashboard.
4.  **Set Route (Optional):** Configure a route (e.g., `your-domain.com/upload`) to trigger your Worker when a POST request is sent to that URL.

### API Usage

1.  **Endpoint:** The API endpoint is the URL of your deployed Cloudflare Worker (or the route you configured).
2.  **Method:** Send a `POST` request to the endpoint.
3.  **Request Body (FormData):** The request body should be `multipart/form-data` and include a file upload field named `"file"` containing your Kotak Bank statement PDF.
4.  **Headers:** Set `Content-Type: multipart/form-data` in your request headers.

**Example `curl` request:**

```bash
curl -X POST -F "file=@/path/to/your/bank_statement.pdf" https://your-cloudflare-worker-url/upload
```

### JSON Response

The API returns a JSON response in the following format:

**Success Response (Status 200 OK):**

```json
{
	"transactions": [
		{
			"date": "01 Jan, 2023",
			"description": "Transaction Description 1",
			"reference": "Reference123",
			"debit": 100.5,
			"credit": 0,
			"balance": 1234.56
		},
		{
			"date": "05 Jan, 2023",
			"description": "Another Transaction",
			"reference": "Ref456",
			"debit": 0,
			"credit": 500.0,
			"balance": 1734.56
		}
		// ... more transactions
	]
}
```

**Error Response (Status 400 or 500):**

```json
{
	"error": "Error processing PDF.",
	"details": "Detailed error message (e.g., 'Please upload a PDF file.', 'No transaction tables found.', or specific parsing error details)"
}
```

## Improvements and Customization

- **Robustness for Combined Statements:** The code is enhanced to handle combined month statements within a single PDF document, correctly parsing transaction tables for each month.
- **Flexibility for Varied Formats:** The parsing logic in `parseTransactionLine` is improved to be more resilient to variations in description and reference formatting within Kotak Bank statements.
- **Customization Points:**
  - **`startKeyword` and `endKeywords`:** Adjust these constants in `extractTransactions` if the table header or summary/footer keywords differ in your statements.
  - **`parseTransactionLine`:** Modify the regular expressions and parsing logic within `parseTransactionLine` if you encounter variations in date formats, amount formats, or transaction description structures.
  - **Reference Number Detection Heuristics:** The logic for identifying reference numbers is heuristic. You might need to refine it further based on more diverse statement examples.

## Disclaimer

This code is specifically tailored for **Kotak Mahindra Bank statements** in PDF format, based on the examples provided. While it aims for accuracy and robustness, bank statement formats can vary.

- **Format Variations:** Kotak Bank might change their statement format in the future, which could break the parser.
- **Other Banks:** This code is **not guaranteed to work** with statements from other banks without modifications.

Always **verify the extracted data** against your bank statement to ensure accuracy, especially after deploying or modifying the code. You may need to fine-tune the parsing logic or provide more examples if you encounter issues with different statement layouts.
