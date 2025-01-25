# Bank Statement PDF Parser Cloudflare Worker

A serverless solution for extracting transaction data from bank statement PDFs. This Cloudflare Worker processes PDF files to return structured transaction information in JSON format.

## Features

- 📄 PDF text extraction using `unpdf` library
- 🔍 Transaction pattern matching with regex
- 🧩 Multi-line transaction merging
- 💰 Automatic debit/credit classification
- 🌐 CORS-enabled API endpoints
- ⚡ Cloudflare Workers edge computing

## Installation

1. Clone repository:

```bash
git clone https://github.com/yourusername/pdf-transaction-parser.git
cd pdf-transaction-parser
```

2. Install dependencies:

```bash
npm install
```

3. Set up Cloudflare Wrangler:

```bash
npm install -g wrangler
wrangler login
```

4. Deploy to Cloudflare Workers:

```bash
wrangler deploy
```

## API Usage

### POST /upload

Accepts PDF files and returns transaction data

**Request:**

```bash
curl -X POST \
  -H "Content-Type: multipart/form-data" \
  -F "file=@statement.pdf" \
  https://your-worker.url/upload
```

**Successful Response (200):**

```json
{
	"transactions": [
		{
			"date": "01 Jan, 2023",
			"description": "Payment Received",
			"reference": "INV123",
			"debit": 0,
			"credit": 1500.0,
			"balance": 2500.0
		},
		{
			"date": "02 Jan, 2023",
			"description": "Office Supplies",
			"reference": "POS456",
			"debit": 200.0,
			"credit": 0,
			"balance": 2300.0
		}
	]
}
```

**Error Responses:**

- 400: Invalid file type
- 404: Invalid endpoint
- 500: PDF processing error

## Data Processing

### Transaction Parsing Logic

1. Identifies transaction table using header keywords
2. Merges multi-line transactions
3. Extracts fields using regular expressions:
   - Date (`^\d{2} \w{3}, \d{4}`)
   - Amount detection (positive/negative values)
   - Balance calculation
   - Reference number parsing

### PDF Structure Requirements

The parser expects PDFs with this format:

```
DATE       TRANSACTION DETAILS          CHEQUE/REFERENCE#  DEBIT   CREDIT  BALANCE
01 Jan     Payment Received INV123                     -   1500.00   2500.00
```

## Limitations

- Requires specific PDF table format
- Amount parsing based on +/- prefixes
- Date format locked to `DD MMM, YYYY`
- Balance column must be present

## Development

### Dependencies

- [unpdf](https://github.com/ndaidong/unpdf): PDF text extraction
- Cloudflare Workers runtime

### Testing

1. Place test PDFs in `/test/files`
2. Run tests:

```bash
npm test
```

## Contributing

PRs welcome! Please include:

- Tests for new features
- Updated documentation
- Type definitions if adding new features

## License

MIT © 2023 Your Name. See [LICENSE](LICENSE) for details.
