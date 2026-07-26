import io
from pypdf import PdfReader
import docx2txt
from app.utils.logger import logger

class DocumentParser:
    @staticmethod
    def extract_text_from_pdf(file_bytes: bytes) -> str:
        """
        Extracts all textual content from a PDF file.
        """
        try:
            pdf_file = io.BytesIO(file_bytes)
            reader = PdfReader(pdf_file)
            text_parts = []
            
            for index, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
                    
            extracted_text = "\n".join(text_parts).strip()
            
            if not extracted_text:
                raise ValueError("Extracted text is empty. The PDF might contain scanned images rather than selectable text.")
                
            return extracted_text
        except Exception as e:
            logger.error(f"Error parsing PDF file: {str(e)}")
            raise ValueError(f"Could not parse PDF document: {str(e)}")

    @staticmethod
    def extract_text_from_docx(file_bytes: bytes) -> str:
        """
        Extracts textual content from a Word Document (.docx).
        """
        try:
            docx_file = io.BytesIO(file_bytes)
            text = docx2txt.process(docx_file)
            extracted_text = text.strip()
            
            if not extracted_text:
                raise ValueError("Extracted Word text is empty.")
                
            return extracted_text
        except Exception as e:
            logger.error(f"Error parsing DOCX file: {str(e)}")
            raise ValueError(f"Could not parse Word document: {str(e)}")

    @classmethod
    def parse_document(cls, file_name: str, file_bytes: bytes) -> str:
        """
        Dispatches document parsing based on the file extension.
        """
        extension = file_name.split(".")[-1].lower()
        
        if extension == "pdf":
            return cls.extract_text_from_pdf(file_bytes)
        elif extension in ["docx", "doc"]:
            return cls.extract_text_from_docx(file_bytes)
        elif extension == "txt":
            try:
                return file_bytes.decode("utf-8").strip()
            except UnicodeDecodeError:
                try:
                    return file_bytes.decode("latin-1").strip()
                except Exception as e:
                    raise ValueError(f"Could not decode text file: {str(e)}")
        else:
            raise ValueError(f"Unsupported document file extension: .{extension}. Only PDF, DOCX, and TXT files are accepted.")
