document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const pdfUpload = document.getElementById('pdfUpload');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const caseOutline = document.getElementById('caseOutline');
    const errorMessage = document.getElementById('errorMessage');

    // Load PDF.js
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    // Set the worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    // Function to extract PDF text
    async function extractPDFText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const typedArray = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument(typedArray).promise;
                    let textContent = '';

                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                        const page = await pdf.getPage(pageNum);
                        const text = await page.getTextContent();
                        textContent += text.items.map(item => item.str).join(' ');
                    }

                    resolve(textContent);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // Function to send PDF text to backend
    async function generateCaseOutline(pdfText) {
        try {
            // Use the deployed Render.com URL in production
            const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000/generate-outline'
                : 'https://your-render-app-name.onrender.com/generate-outline';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pdfText })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate case outline');
            }

            return await response.json();
        } catch (error) {
            console.error('Error calling backend:', error);
            throw error;
        }
    }

    // Function to parse and display the case outline
    function displayCaseOutline(outline) {
        // Reset previous outline
        ['caseName', 'bluebookCitation', 'caseFacts', 'legalIssues', 
         'proceduralPosture', 'plaintiffArguments', 'defendantArguments', 
         'courtHolding', 'legalReasoning', 'ruleOfLaw', 'relevantQuotes']
        .forEach(id => {
            const element = document.getElementById(id);
            if (element.tagName === 'UL') {
                element.innerHTML = '';
            } else {
                element.textContent = '';
            }
        });

        // Populate sections
        document.getElementById('caseName').textContent = outline.caseName || '';
        document.getElementById('bluebookCitation').textContent = outline.bluebookCitation || '';
        
        // Populate list sections
        const listSections = [
            { key: 'caseFacts', elementId: 'caseFacts' },
            { key: 'legalIssues', elementId: 'legalIssues' },
            { key: 'plaintiffArguments', elementId: 'plaintiffArguments' },
            { key: 'defendantArguments', elementId: 'defendantArguments' },
            { key: 'relevantQuotes', elementId: 'relevantQuotes' }
        ];

        listSections.forEach(section => {
            const element = document.getElementById(section.elementId);
            const items = outline[section.key] || [];
            items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                element.appendChild(li);
            });
        });

        // Populate text sections
        const textSections = [
            { key: 'proceduralPosture', elementId: 'proceduralPosture' },
            { key: 'courtHolding', elementId: 'courtHolding' },
            { key: 'legalReasoning', elementId: 'legalReasoning' },
            { key: 'ruleOfLaw', elementId: 'ruleOfLaw' }
        ];

        textSections.forEach(section => {
            const element = document.getElementById(section.elementId);
            element.textContent = outline[section.key] || '';
        });

        // Show outline, hide spinner
        loadingSpinner.classList.add('hidden');
        caseOutline.classList.remove('hidden');
    }

    // Form submission handler
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset previous state
        errorMessage.textContent = '';
        errorMessage.classList.add('hidden');
        caseOutline.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');

        const file = pdfUpload.files[0];
        if (!file) {
            errorMessage.textContent = 'Please upload a PDF file.';
            errorMessage.classList.remove('hidden');
            loadingSpinner.classList.add('hidden');
            return;
        }

        try {
            // Extract PDF text
            const pdfText = await extractPDFText(file);

            // Generate case outline
            const caseOutline = await generateCaseOutline(pdfText);

            // Display case outline
            displayCaseOutline(caseOutline);

        } catch (error) {
            console.error('Error processing PDF:', error);
            errorMessage.textContent = error.message || 'Error processing the PDF. Please try again or ensure it is a valid legal case document.';
            errorMessage.classList.remove('hidden');
            loadingSpinner.classList.add('hidden');
        }
    });
});
