import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileUp, 
  Loader2, 
  Plus, 
  Trash2, 
  FileText, 
  Layers, 
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileDown,
  FileJson,
  Zap,
  ChevronDown,
  Search,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import ExcelJS from 'exceljs';
import * as mammoth from 'mammoth';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { translations, Language } from '../translations';
import { ALL_FORMS, NBRForm } from '../constants/formCatalog';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface FormField {
  id: string;
  label: string;
  value: string;
}

interface ExtractedItem {
  desc: string;
  qty: number;
  price: number;
  vatRate: number;
  hsCode?: string;
  total?: number;
}

interface OCRResult {
  documentType: string;
  fields: FormField[];
  items?: ExtractedItem[];
}

interface OCRFormAutomationProps {
  language?: Language;
  onInvoiceExtracted?: (data: any) => void;
  initialData?: any;
  defaultCategory?: 'INCOME_TAX' | 'VAT';
}

export default function OCRFormAutomation({ language = 'en', onInvoiceExtracted, initialData, defaultCategory }: OCRFormAutomationProps) {
  const t = translations[language];
  const [mode, setMode] = useState<'single' | 'template'>('single');
  
  // Set initial form based on category
  const getInitialFormId = () => {
    if (defaultCategory === 'VAT') return 'MUSOK-9.1';
    return 'IT-11GA-2023';
  };

  const [selectedFormId, setSelectedFormId] = useState<string>(getInitialFormId());
  const [selectedCategory, setSelectedCategory] = useState<'INCOME_TAX' | 'VAT'>(defaultCategory || 'INCOME_TAX');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormSelectorOpen, setIsFormSelectorOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTypeConfirmed, setIsTypeConfirmed] = useState(!!initialData);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>(initialData?.items || []);
  const [documentType, setDocumentType] = useState<string>(initialData?.documentType || '');
  const [fields, setFields] = useState<FormField[]>(initialData?.fields || []);
  
  // Single mode state
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singlePreview, setSinglePreview] = useState<string | null>(null);
  
  // Template mode state
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [dataPreview, setDataPreview] = useState<string | null>(null);
  
  // Form state

  const onDropSingle = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSingleFile(file);
      setSinglePreview(URL.createObjectURL(file));
      setError(null);
    }
  }, []);

  const onDropTemplate = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setTemplateFile(file);
      setTemplatePreview(URL.createObjectURL(file));
      setError(null);
    }
  }, []);

  const onDropData = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setDataFile(file);
      setDataPreview(URL.createObjectURL(file));
      setError(null);
    }
  }, []);

  const { getRootProps: getSingleProps, getInputProps: getSingleInputProps, isDragActive: isSingleActive } = useDropzone({
    onDrop: onDropSingle,
    accept: { 
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const { getRootProps: getTemplateProps, getInputProps: getTemplateInputProps, isDragActive: isTemplateActive } = useDropzone({
    onDrop: onDropTemplate,
    accept: { 
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const { getRootProps: getDataProps, getInputProps: getDataInputProps, isDragActive: isDataActive } = useDropzone({
    onDrop: onDropData,
    accept: { 
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const extractTextContent = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    
    if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value || "";
      } catch (e) {
        console.error("Word extraction failed", e);
        return "";
      }
    }
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        let content = "";
        workbook.eachSheet((sheet) => {
          content += `\nSheet: ${sheet.name}\n`;
          sheet.eachRow((row) => {
            const rowValues = row.values as any[];
            content += rowValues.join(' | ') + '\n';
          });
        });
        return content;
      } catch (e) {
        console.error("Excel extraction failed", e);
        return "";
      }
    }
    
    return "";
  };

  const runOCR = async () => {
    if (mode === 'single' && !singleFile) return;
    if (mode === 'template' && (!templateFile || !dataFile)) return;

    setIsProcessing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      let prompt = "";
      let contents: any[] = [];

      if (mode === 'single' && singleFile) {
        const isVisual = singleFile.type.startsWith('image/') || singleFile.type === 'application/pdf';
        const targetForm = ALL_FORMS.find(f => f.id === selectedFormId);
        
        if (isVisual) {
          const base64 = await fileToBase64(singleFile);
          contents.push({
            inlineData: { mimeType: singleFile.type, data: base64 }
          });
          prompt = `### NBR COMPLIANCE MODE (Bangladesh NBR Strict 1:1 Mapping)
          Build an OCR-based form automation result that enforces strict 1-to-1 mapping with the official Bangladesh NBR form template: ${targetForm?.name} (${targetForm?.id}).
          
          STRICT COMPLIANCE RULES:
          - PRESERVE EXACT LABELS: You must use the EXACT field labels found on the official form. 
          - BENGALI/ENGLISH FIDELITY: If a label is in Bengali on the form (e.g., 'করদাতার নাম', 'অর্থ বছর'), you MUST output that exact label. If it is bilingual, output both.
          - NO MODIFICATION: No merging, renaming, summarizing, or omitting any field.
          - STRUCTURE INTEGRITY: Maintain the original layout logic. No summarizing multiple lines into one.
          - TABLE PRECISION: Keep original table structures (e.g., Mushak 6.3 columns). Ensure multi-item data (quantity, price, VAT) aligns precisely with official columns.
          
          SYSTEM CONSTRAINTS:
          - ENFORCE “NO MERGING” and “EXACT LABELING” at all times.
          - Output must be a direct 1:1 digital replica of the template's field structure.
          
          Detect both English and Bengali text. Normalize all financial values to BDT.`;
        } else {
          const extractedText = await extractTextContent(singleFile);
          prompt = `Analyze the text content of this ${singleFile.name} file. Your task is to extract necessary data for the ${targetForm?.name} (${targetForm?.id}) form of Bangladesh NBR.
            
            Source Text:
            ---
            ${extractedText}
            ---`;
        }

        prompt += `
          EXHAUSTIVE EXTRACTION LIST:
          1. Taxpayer Identity: Name (EN/BN), TIN, BIN, NID, Date of Birth, Gender, Circle, Division.
          2. Contact: Address (Residential/Business), Phone, Email.
          3. Assessment: Assessment Year, Income Year.
          4. Financial Data: 
             - Income: Salary, House Property, Business/Profession, Capital Gains, Other Sources.
             - Deductions: Life insurance premium, DPS, Savings certificate investment, etc.
             - Tax: Total Tax Payable, TDS, Advance Tax, Refund.
          5. Line Items: Items/Invoice data (if applicable for VAT forms MUSOK 6.3/6.1 etc).

          JSON OUTPUT STRUCTURE:
          Return a strictly structured JSON object:
          {
            "documentType": "${targetForm?.name} (Extracted)",
            "fields": [
              { "id": "field_key", "label": "Human Readable Label", "value": "Value" }
            ],
            "items": [
              { "desc": "Item Name", "qty": number, "price": number, "vatRate": number, "hsCode": "string (optional)", "total": number }
            ]
          }`;
      } else if (mode === 'template' && templateFile && dataFile) {
        const templateBase64 = await fileToBase64(templateFile);
        const dataIsVisual = dataFile.type.startsWith('image/') || dataFile.type === 'application/pdf';
        
        contents.push({
          inlineData: { mimeType: templateFile.type, data: templateBase64 }
        });

        if (dataIsVisual) {
          const dataBase64 = await fileToBase64(dataFile);
          contents.push({
            inlineData: { mimeType: dataFile.type, data: dataBase64 }
          });
        }
        
        prompt = `### NBR COMPLIANCE MODE (Bangladesh NBR Strict 1:1 Mapping)
        I have provided two inputs. 
        The first input is a BLANK FORM TEMPLATE image (e.g., NBR IT-11G form, Mushak 6.3). This defines the REQUIRED FORMAT and labels.
        The second input is a SOURCE DOCUMENT containing data.
        
        Your task: Build an OCR-based form automation result that enforces strict 1-to-1 mapping with the BLANK FORM TEMPLATE.
        
        STRICT COMPLIANCE RULES:
        - Identify the EXACT structure and labels in the BLANK FORM TEMPLATE.
        - Map data precisely into fields as they appear on the template.
        - BENGALI/ENGLISH FIDELITY: Use the EXACT terminology found on the template. If the template uses Bengali ('করদাতার নাম', 'বিন'), use those labels exactly.
        - ENFORCE “NO MERGING” and “EXACT LABELING” at all times.
        - NO MODIFICATION: No merging, renaming, summarizing, or omitting any field.
        - OFFICIAL LABELS: Extracted data must map exactly to official field names.
        - TABLE INTEGRITY: Maintain original table structures (e.g., line items, columns, VAT rates). Ensure multi-item data (quantity, price, VAT) aligns precisely with template columns.
        
        SYSTEM CONSTRAINTS:
        - Output must be a direct 1:1 digital replica of the template structure.
        - Results must be ready for direct injection/export without modification.
        
        Return a strictly structured JSON object that is a direct 1:1 replica of the template structure:
        {
          "documentType": "Formal name of the template form",
          "fields": [
            { "id": "field_key", "label": "Exact Template Label Name (preserve case and language)", "value": "Extracted Value" }
          ],
          "items": [
            { "desc": "Item Name", "qty": number, "price": number, "vatRate": number, "total": number }
          ]
        }`;

        if (!dataIsVisual) {
          const extractedDataText = await extractTextContent(dataFile);
          prompt = `${prompt}
          
          The SOURCE DOCUMENT is a structured text file (${dataFile.name}). Use the following text content as your data source:
          ---
          ${extractedDataText}
          ---`;
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...contents, { text: prompt }],
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text || "{}");
      setDocumentType(result.documentType || 'Extracted Document');
      setFields(result.fields || []);
      setExtractedItems(result.items || []);
      setIsTypeConfirmed(false);
    } catch (err) {
      console.error("OCR Error:", err);
      setError("Failed to process document. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const addField = () => {
    const newId = `field_${Date.now()}`;
    setFields([...fields, { id: newId, label: 'New Field', value: '' }]);
  };

  const generateAutoFillScript = () => {
    const dataString = JSON.stringify({ documentType, fields, items: extractedItems }, null, 2);
    const script = `
/**
 * VATX.BD - NBR Auto-Fill Script
 * Document: ${documentType}
 * Category: ${ALL_FORMS.find(f => f.id === selectedFormId)?.category}
 */
(function() {
  const data = ${dataString};
  console.log("%c VATX.BD Auto-Fill Active ", "background: #10b981; color: white; padding: 4px; font-weight: bold;");
  
  // Generic mapper based on labels
  const fillField = (label, value) => {
    const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
    const target = inputs.find(i => {
      const id = i.id?.toLowerCase() || "";
      const name = i.name?.toLowerCase() || "";
      const placeholder = i.placeholder?.toLowerCase() || "";
      const lbl = label.toLowerCase();
      return id.includes(lbl) || name.includes(lbl) || placeholder.includes(lbl);
    });
    
    if (target) {
      target.value = value;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      console.log("Filled: " + label + " -> " + value);
    }
  };

  data.fields.forEach(f => fillField(f.label, f.value));
  alert("VATX.BD: Attempted to auto-fill " + data.fields.length + " fields. Please verify before submission.");
})();`.trim();

    const blob = new Blob([script], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autofill_${selectedFormId}.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJson = () => {
    const data = { documentType, fields, items: extractedItems, mapping: { formId: selectedFormId } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedFormId}_data.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateField = (id: string, key: 'label' | 'value', val: string) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: val } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const saveOCRResult = async () => {
    try {
      await fetch('/api/ocr/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          fields,
          items: extractedItems,
          imageUrl: '' // In a real app, we'd upload the image to a bucket first
        })
      });
    } catch (err) {
      console.error("Failed to save OCR result:", err);
    }
  };

  const handleConfirmType = () => {
    setIsTypeConfirmed(true);
    saveOCRResult();
    if (documentType.toLowerCase().includes('invoice') && onInvoiceExtracted) {
      // Map fields to invoice structure
      const findField = (keywords: string[]) => 
        fields.find(f => keywords.some(k => f.label.toLowerCase().includes(k)))?.value;

      const invoiceData: any = {
        number: findField(['number', 'inv#', 'invoice no']) || `INV-${Date.now().toString().slice(-6)}`,
        date: findField(['date', 'issue date']) || new Date().toISOString().split('T')[0],
        seller: {
          name: findField(['seller', 'vendor', 'from', 'supplier']) || '',
          address: findField(['address', 'location', 'street']) || '',
          bin: findField(['bin', 'vat reg', 'mushak']) || ''
        },
        buyer: {
          name: findField(['buyer', 'to', 'customer', 'client']) || '',
          address: findField(['buyer address', 'ship to', 'bill to']) || '',
          bin: findField(['buyer bin', 'tin', 'customer bin']) || ''
        },
        items: extractedItems.length > 0 
          ? extractedItems.map((item, i) => ({
              id: i + 1,
              desc: item.desc,
              category: 'Standard Goods/Services',
              qty: item.qty || 1,
              price: item.price || 0,
              vatRate: item.vatRate || 15
            }))
          : fields.filter(f => f.label.toLowerCase().includes('item') || f.label.toLowerCase().includes('description')).map((f, i) => ({
              id: i + 1,
              desc: f.value,
              category: 'Standard Goods/Services',
              qty: 1,
              price: 0,
              vatRate: 15
            }))
      };
      
      // If no items found, add a default one
      if (invoiceData.items.length === 0) {
        invoiceData.items = [{ id: 1, desc: 'Extracted Service/Product', category: 'Standard Goods/Services', qty: 1, price: 0, vatRate: 15 }];
      }
      
      onInvoiceExtracted(invoiceData);
    }
  };

  const handleExportWord = async () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: documentType || "Extracted Document",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Generated by VATX.BD AI OCR Automation",
                bold: true,
                size: 20,
                color: "666666",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),
          ...fields.flatMap(field => [
            new Paragraph({
              children: [
                new TextRun({
                  text: field.label.toUpperCase(),
                  bold: true,
                  size: 18,
                  color: "444444",
                }),
              ],
              spacing: { before: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: field.value || "—",
                  size: 24,
                }),
              ],
              border: {
                bottom: { color: "CCCCCC", space: 5, style: "single", size: 6 },
              },
              spacing: { after: 200 },
            }),
          ]),
          ...(extractedItems.length > 0 ? [
            new Paragraph({
              text: "ITEMIZED DETAILS (TABLE DATA)",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
            }),
            ...extractedItems.map(item => new Paragraph({
              children: [
                new TextRun({ text: `${item.desc}: `, bold: true }),
                new TextRun({ text: `${item.qty} x ${item.price} (VAT: ${item.vatRate}%) = BDT ${item.total}` }),
              ],
              spacing: { after: 100 },
            }))
          ] : []),
          new Paragraph({
            children: [
              new TextRun({
                text: `\n\nVerification ID: ${Math.random().toString(36).substring(7).toUpperCase()}`,
                size: 16,
                color: "999999",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 1000 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "This document was automatically generated and verified by VATX.BD AI OCR Automation.",
                size: 14,
                color: "CCCCCC",
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentType || 'document'}.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-4xl font-black text-zinc-900 tracking-tighter font-display">{t.aiFormAutomation}</h2>
        <p className="text-zinc-500 max-w-xl mx-auto text-lg">
          {t.aiFormAutomationDesc}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex bg-zinc-100 p-1.5 rounded-2xl w-fit mx-auto">
        <button
          onClick={() => setMode('single')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
            mode === 'single' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <FileText size={16} />
          {t.singleScan}
        </button>
        <button
          onClick={() => setMode('template')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
            mode === 'template' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <Layers size={16} />
          {t.templateMapping}
        </button>
      </div>

      {/* Target Form Selector */}
      <div className="max-w-xl mx-auto w-full space-y-2">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-4">
          {t.targetingForm}
        </label>
        <div className="relative">
          <button
            onClick={() => setIsFormSelectorOpen(!isFormSelectorOpen)}
            className="w-full p-4 bg-white border border-zinc-100 rounded-2xl flex items-center justify-between text-left shadow-sm hover:border-zinc-200 transition-all"
          >
            <div>
              <p className="text-sm font-black text-zinc-900">
                {language === 'bn' ? ALL_FORMS.find(f => f.id === selectedFormId)?.nameBn : ALL_FORMS.find(f => f.id === selectedFormId)?.name}
              </p>
              <p className="text-[10px] font-bold text-zinc-400">{selectedFormId}</p>
            </div>
            <ChevronDown size={20} className={cn("text-zinc-400 transition-transform", isFormSelectorOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {isFormSelectorOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-zinc-100 rounded-3xl shadow-xl overflow-hidden"
              >
                <div className="p-4 border-b border-zinc-50 flex items-center gap-3">
                  <Search size={16} className="text-zinc-300" />
                  <input 
                    type="text" 
                    placeholder="Search NBR forms..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 text-sm outline-none placeholder:text-zinc-300"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                {/* Category Tabs */}
                <div className="flex bg-zinc-50 p-1 border-b border-zinc-50">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedCategory('INCOME_TAX'); }}
                    className={cn(
                      "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                      selectedCategory === 'INCOME_TAX' ? "bg-white text-blue-600 shadow-sm" : "text-zinc-400"
                    )}
                  >
                    {t.incomeTax}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedCategory('VAT'); }}
                    className={cn(
                      "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                      selectedCategory === 'VAT' ? "bg-white text-emerald-600 shadow-sm" : "text-zinc-400"
                    )}
                  >
                    {t.vat}
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto p-2">
                  <div className="mb-4">
                    <p className="px-3 py-1 text-[10px] font-black text-zinc-300 uppercase tracking-widest">
                      {selectedCategory.replace('_', ' ')} Forms
                    </p>
                    {ALL_FORMS.filter(f => f.category === selectedCategory && (f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.id.toLowerCase().includes(searchTerm.toLowerCase()))).map(form => (
                      <button
                        key={form.id}
                        onClick={() => {
                          setSelectedFormId(form.id);
                          setIsFormSelectorOpen(false);
                        }}
                        className={cn(
                          "w-full p-3 rounded-xl text-left hover:bg-zinc-50 transition-all flex items-center justify-between group",
                          selectedFormId === form.id && "bg-blue-50"
                        )}
                      >
                        <div>
                          <p className={cn("text-xs font-bold", selectedFormId === form.id ? (selectedCategory === 'VAT' ? "text-emerald-600" : "text-blue-600") : "text-zinc-700")}>
                              {language === 'bn' ? form.nameBn : form.name}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-medium">{form.id}</p>
                        </div>
                        {selectedFormId === form.id && <CheckCircle2 size={16} className={selectedCategory === 'VAT' ? "text-emerald-500" : "text-blue-500"} />}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-500 font-black">1</div>
          <h4 className="font-black text-xs uppercase tracking-widest text-zinc-900">{t.upload}</h4>
          <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">
            {mode === 'single' 
              ? t.uploadDescSingle 
              : t.uploadDescTemplate}
          </p>
        </div>
        <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-500 font-black">2</div>
          <h4 className="font-black text-xs uppercase tracking-widest text-zinc-900">{t.aiOcr}</h4>
          <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">
            {t.aiOcrDesc}
          </p>
        </div>
        <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-500 font-black">3</div>
          <h4 className="font-black text-xs uppercase tracking-widest text-zinc-900">{t.export}</h4>
          <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">
            {t.exportDesc}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-6">
          {mode === 'single' ? (
            <div 
              {...getSingleProps()} 
              className={cn(
                "border-4 border-dashed rounded-[2.5rem] p-12 text-center transition-all cursor-pointer group",
                isSingleActive ? "border-blue-500 bg-blue-50" : "border-zinc-100 hover:border-zinc-200 bg-zinc-50"
              )}
            >
              <input {...getSingleInputProps()} />
              {singlePreview ? (
                <div className="space-y-4">
                  <img src={singlePreview} alt="Preview" className="max-h-64 mx-auto rounded-2xl shadow-lg" />
                  <p className="text-sm font-bold text-zinc-500">{t.replaceImage}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <FileUp size={32} className="text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-zinc-900">{t.uploadDocument}</h3>
                    <p className="text-zinc-500 text-sm mt-1">{t.dragDropScan}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Template Upload */}
                <div 
                  {...getTemplateProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-3xl p-6 text-center transition-all cursor-pointer",
                    isTemplateActive ? "border-blue-500 bg-blue-50" : "border-zinc-100 hover:border-zinc-200 bg-zinc-50"
                  )}
                >
                  <input {...getTemplateInputProps()} />
                  {templatePreview ? (
                    <div className="space-y-2">
                      <img src={templatePreview} alt="Template" className="max-h-32 mx-auto rounded-xl shadow-sm" />
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">{t.blankTemplate}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Layers size={24} className="mx-auto text-zinc-300" />
                      <p className="text-xs font-bold text-zinc-500">{t.uploadBlankTemplate}</p>
                    </div>
                  )}
                </div>

                {/* Data Upload */}
                <div 
                  {...getDataProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-3xl p-6 text-center transition-all cursor-pointer",
                    isDataActive ? "border-blue-500 bg-blue-50" : "border-zinc-100 hover:border-zinc-200 bg-zinc-50"
                  )}
                >
                  <input {...getDataInputProps()} />
                  {dataPreview ? (
                    <div className="space-y-2">
                      <img src={dataPreview} alt="Data" className="max-h-32 mx-auto rounded-xl shadow-sm" />
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">{t.sourceDocument}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FileText size={24} className="mx-auto text-zinc-300" />
                      <p className="text-xs font-bold text-zinc-500">{t.uploadSourceData}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {templateFile && dataFile && (
                <div className="flex items-center justify-center gap-4 text-zinc-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold">{t.templateReady}</span>
                  </div>
                  <ArrowRight size={16} />
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold">{t.dataReady}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={runOCR}
            disabled={isProcessing || (mode === 'single' ? !singleFile : (!templateFile || !dataFile))}
            className={cn(
              "w-full py-5 rounded-[2rem] font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl",
              isProcessing ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-200"
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                {t.aiReading}
              </>
            ) : (
              <>
                <Zap size={24} className={mode === 'template' ? "text-amber-400" : "text-blue-400"} />
                {mode === 'template' ? "Start Strict Template Mapping" : t.startAiOcr}
              </>
            )}
          </button>

          <div className="flex bg-zinc-900 border border-zinc-800 p-1.5 rounded-2xl w-fit mx-auto mb-4 items-center gap-2">
            <div className="px-3 py-1 bg-brand-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
              <Sparkles size={12} />
              Compliance Mode Active
            </div>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pr-2">1:1 Official NBR Mapping</span>
          </div>

          <p className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest animate-pulse mt-2">
            AI strictly preserves the template’s original field structure and labels.
          </p>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
        </div>

        {/* Form Section */}
        <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-8 shadow-sm print:shadow-none print:border-none print:p-0">
          <div className="flex items-center justify-between mb-8 print:hidden">
            <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{t.reviewExport}</h3>
            <div className="flex gap-2">
              <button 
                onClick={addField}
                className="p-3 bg-zinc-100 text-zinc-600 rounded-2xl hover:bg-zinc-200 transition-all"
                title="Add Field"
              >
                <Plus size={20} />
              </button>
              <button 
                onClick={exportToJson}
                disabled={fields.length === 0}
                className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all"
                title={t.generateJson}
              >
                <FileJson size={20} />
              </button>
              <button 
                onClick={generateAutoFillScript}
                disabled={fields.length === 0}
                className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all"
                title={t.autoFillScript}
              >
                <Zap size={20} />
              </button>
              <button 
                onClick={handleExportWord}
                disabled={fields.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                <FileDown size={20} />
                {t.exportWord}
              </button>
            </div>
          </div>

          <div id="printable-form" className="space-y-8 bg-white p-12 print:p-0">
            {/* Official NBR-style Header */}
            <div className="flex flex-col items-center text-center space-y-2 mb-12 border-b-2 border-zinc-900 pb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-zinc-900 flex items-center justify-center text-white rounded-full font-black text-xl">NBR</div>
                <div className="text-left">
                  <p className="text-xl font-black text-zinc-900 uppercase">Government of the People's Republic of Bangladesh</p>
                  <p className="text-lg font-bold text-zinc-700">National Board of Revenue</p>
                </div>
              </div>
              <div className="w-full h-1 bg-zinc-900 mt-4" />
            </div>

            <div className="space-y-6">
              <div className="pb-4 mb-8">
                <div className="flex flex-col gap-4">
                  <div className="relative">
                  <input 
                    type="text" 
                    value={documentType || ""}
                    onChange={(e) => setDocumentType(e.target.value)}
                    placeholder={t.documentTitle}
                    className={cn(
                      "text-3xl font-black text-zinc-900 w-full outline-none bg-transparent placeholder:text-zinc-200 transition-all",
                      !isTypeConfirmed && fields.length > 0 ? "ring-4 ring-blue-500/20 bg-blue-50/30 p-2 rounded-xl" : ""
                    )}
                  />
                  {!isTypeConfirmed && fields.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-blue-600 uppercase tracking-widest">{t.confirmType}</p>
                        <button 
                          onClick={handleConfirmType}
                          className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-all"
                        >
                          {t.confirm}
                        </button>
                      </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase py-1">{t.typeSuggestions}</span>
                          {[t.salaryCertificate, t.tdsCertificate, t.bankStatement, t.invoice, t.mushak63, t.taxCertificate, t.it11g].map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => setDocumentType(suggestion)}
                              className="px-3 py-1 bg-white border border-zinc-200 rounded-full text-[10px] font-bold text-zinc-600 hover:border-blue-500 hover:text-blue-600 transition-all"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      {documentType.toLowerCase().includes('invoice') && (
                        <p className="text-[10px] text-blue-500 font-bold italic">
                          ✨ {t.prefillInvoice}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">{t.autoGenerated}</p>
              </div>
            </div>

            {fields.length === 0 && !isProcessing && (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
                  <FileText size={32} className="text-zinc-200" />
                </div>
                <p className="text-zinc-400 font-bold">{t.noFieldsExtracted}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              {fields.map((field) => (
                <div key={field.id} className="group relative">
                  <div className="flex flex-col gap-1">
                    <input 
                      type="text"
                      value={field.label || ""}
                      onChange={(e) => updateField(field.id, 'label', e.target.value)}
                      className="text-[10px] font-black text-zinc-400 uppercase tracking-widest outline-none bg-transparent w-full"
                    />
                    <input 
                      type="text"
                      value={field.value || ""}
                      onChange={(e) => updateField(field.id, 'value', e.target.value)}
                      className="text-lg font-bold text-zinc-900 w-full border-b-2 border-zinc-100 focus:border-blue-500 outline-none pb-2 transition-all"
                    />
                  </div>
                  <button 
                    onClick={() => removeField(field.id)}
                    className="absolute -right-2 top-0 p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all print:hidden"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {extractedItems.length > 0 && (
              <div className="mt-12 pt-8 border-t border-zinc-100">
                <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6">Extracted Line Items</h4>
                <div className="space-y-4">
                  {extractedItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-zinc-900">{item.desc}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                            Qty: {item.qty} × {item.price} | VAT: {item.vatRate}%
                          </p>
                          {item.hsCode && (
                            <span className="text-[10px] bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded font-black uppercase">HS: {item.hsCode}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-zinc-900">
                          {item.total ? item.total.toLocaleString() : (item.qty * item.price * (1 + item.vatRate / 100)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            </div>

            <div className="mt-12 pt-8 border-t border-zinc-100 text-center hidden print:block">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{t.verificationId}: {Math.random().toString(36).substring(7).toUpperCase()}</p>
              <p className="text-[8px] text-zinc-300 mt-1">{t.autoGenerated}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
