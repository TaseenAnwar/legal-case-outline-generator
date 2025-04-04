const express = require('express');
const multer = require('multer');
const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

// Configure OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// PDF text extraction and case outline generation route
app.post('/generate-outline', upload.single('pdf'), async (req, res) => {
    try {
        // Load PDF text
        const loader = new PDFLoader(req.file.path);
        const docs = await loader.load();
        const pdfText = docs.map(doc => doc.pageContent).join('\n');

        // Generate case outline using OpenAI
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are a legal research assistant specialized in creating detailed case outlines.'
                },
                {
                    role: 'user',
