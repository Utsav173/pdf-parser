import { extractText, getDocumentProxy } from 'unpdf';

function parseTransactionLine(line) {
	const dateRegex = /^(\d{2} \w{3}, \d{4})/;
	const match = line.match(dateRegex);
	if (!match) return null;

	const date = match[1];
	let remainingLine = line.substring(date.length).trim();

	// Enhanced logic for description and reference separation
	let description = '';
	let reference = '';
	let amountsPart = '';

	const amountRegex = /([+-]?[\d,]+\.\d{2})\s*([\d,]+\.\d{2})?$/; // Regex to capture amounts at the end

	const amountMatch = remainingLine.match(amountRegex);
	if (amountMatch) {
		amountsPart = remainingLine.slice(remainingLine.lastIndexOf(amountMatch[0])).trim();
		const detailsPart = remainingLine.slice(0, remainingLine.lastIndexOf(amountMatch[0])).trim();

		// Further split details part to separate description and reference (heuristic based on typical statement format)
		const detailWords = detailsPart.split(/\s+/);
		if (
			(detailWords.length > 1 && detailWords.slice(-1)[0].startsWith('UPI')) ||
			detailWords.slice(-1)[0].startsWith('FCM') ||
			detailWords.slice(-1)[0].startsWith('IMPS') ||
			detailWords.slice(-1)[0].match(/^\d+$/)
		) {
			reference = detailWords.pop(); // Assume last word is reference if it looks like UPI/RefNo
			description = detailWords.join(' ').trim();
		} else {
			description = detailsPart; // If no clear reference, treat entire detail as description
		}
	} else {
		return null; // If no amounts found, skip line (not a transaction)
	}

	const amounts = amountsPart
		.split(/\s+/)
		.map((amt) => parseFloat(amt.replace(/[^\d.-]/g, '')) || 0);

	let debit = 0;
	let credit = 0;
	if (amounts[0] < 0) {
		debit = Math.abs(amounts[0]);
	} else {
		credit = amounts[0];
	}

	return {
		date,
		description: description.replace(/3 /, '').trim(), // Clean up description
		reference: reference.trim(),
		debit,
		credit,
		balance: amounts[1] || 0,
	};
}

function mergeTransactionLines(lines) {
	const dateRegex = /^\d{2}\s\w{3},\s\d{4}/;
	const mergedLines = [];
	let currentLineGroup = [];

	lines.forEach((line) => {
		if (dateRegex.test(line.trim())) {
			if (currentLineGroup.length) mergedLines.push(currentLineGroup.join(' ').trim());
			currentLineGroup = [line.trim()];
		} else {
			currentLineGroup.push(line.trim());
		}
	});

	if (currentLineGroup.length) mergedLines.push(currentLineGroup.join(' ').trim());
	return mergedLines;
}

async function extractTransactions(dataBuffer) {
	try {
		const pdf = await getDocumentProxy(new Uint8Array(dataBuffer));
		const { text: pageTexts } = await extractText(pdf, { mergePages: false });

		const startKeyword = 'DATE TRANSACTION DETAILS CHEQUE/REFERENCE# DEBIT CREDIT BALANCE';
		const endKeywords = ['SUMMARY', 'Page ', 'AP-Aut'];

		let allTransactions = [];

		for (const pageText of pageTexts) {
			const lines = pageText.split('\n');
			const startIdx = lines.findIndex((line) => line.includes(startKeyword));
			if (startIdx !== -1) {
				const endIdx = lines.findIndex(
					(line, idx) => idx > startIdx && endKeywords.some((key) => line.startsWith(key)),
				);

				const transactionLines = lines
					.slice(startIdx + 1, endIdx > -1 ? endIdx : undefined)
					.filter((line) => line.trim() && !line.startsWith('Page '));

				const mergedLines = mergeTransactionLines(transactionLines); // Merge lines first!
				const parsedLines = mergedLines.map(parseTransactionLine).filter(Boolean);

				allTransactions = [...allTransactions, ...parsedLines];
			}
		}

		if (!allTransactions.length) throw new Error('No transaction tables found.');

		return allTransactions;
	} catch (error) {
		console.error('Error during PDF parsing:', error);
		return { error: 'Error processing PDF', details: error.message };
	}
}

export default {
	async fetch(request, env, ctx) {
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		if (request.method === 'POST' && new URL(request.url).pathname === '/upload') {
			try {
				const formData = await request.formData();
				const file = formData.get('file');

				if (!file || file.type !== 'application/pdf') {
					return new Response(JSON.stringify({ error: 'Please upload a PDF file.' }), {
						status: 400,
						headers: {
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*',
						},
					});
				}

				const arrayBuffer = await file.arrayBuffer();
				const transactions = await extractTransactions(arrayBuffer);

				return new Response(JSON.stringify({ transactions }, null, 2), {
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			} catch (error) {
				return new Response(
					JSON.stringify({ error: 'Error processing PDF.', details: error.message }),
					{
						status: 500,
						headers: {
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*',
						},
					},
				);
			}
		}

		return new Response(JSON.stringify({ error: 'Not Found' }), {
			status: 404,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
		});
	},
};
