#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MineOS - Extractor Estricto y Geométrico de Tablas en PDF
Utiliza pdfplumber para identificar y mapear tablas, evitando desfasamientos 
de columnas al respetar celdas vacías mediante estrategias geométricas/híbridas.
"""

import sys
import json
import argparse
import os

try:
    import pdfplumber
except ImportError:
    print(json.dumps({
        "error": "Librería 'pdfplumber' no instalada. Por favor ejecute: pip install pdfplumber"
    }, indent=2))
    sys.exit(1)

def extract_tables_from_pdf(pdf_path):
    if not os.path.exists(pdf_path):
        return {"error": f"El archivo especificado no existe en la ruta: {pdf_path}"}

    results = []

    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                # 1. Estrategia 1: Líneas explicitas (ideal para tablas con bordes o celdas unidas)
                table_settings = {
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "lines",
                    "snap_tolerance": 3,
                    "join_tolerance": 3,
                    "edge_min_length": 10,
                }
                
                tables = page.extract_tables(table_settings)
                
                # 2. Fallback Estrategia 2: Basado en alineación de texto (para tablas sin bordes visibles)
                if not tables or len(tables) == 0 or all(len(t) == 0 for t in tables):
                    table_settings = {
                        "vertical_strategy": "text",
                        "horizontal_strategy": "text",
                        "snap_tolerance": 4,
                    }
                    tables = page.extract_tables(table_settings)
                
                # 3. Fallback Estrategia 3: Algoritmo por defecto de pdfplumber
                if not tables or len(tables) == 0:
                    tables = page.extract_tables()

                page_tables_clean = []
                for table in tables:
                    table_clean = []
                    for row in table:
                        # Limpiar cada celda reemplazando None por "" y removiendo saltos de línea molestos
                        row_clean = []
                        for cell in row:
                            if cell is None:
                                row_clean.append("")
                            else:
                                val = str(cell).strip().replace("\r", " ").replace("\n", " ")
                                row_clean.append(val)
                        table_clean.append(row_clean)
                    page_tables_clean.append(table_clean)

                results.append({
                    "page": page_num,
                    "width": float(page.width),
                    "height": float(page.height),
                    "tables": page_tables_clean
                })
        
        return {"ok": True, "pages": results}

    except Exception as e:
        return {"error": f"Fallo catastrófico en la extracción geométrica de PDF: {str(e)}"}

def main():
    parser = argparse.ArgumentParser(description="Extrae tablas estructuradas de un PDF de nómina de forma geométrica.")
    parser.add_argument("pdf_path", help="Ruta al archivo PDF a procesar")
    parser.add_argument("--pretty", action="store_true", help="Imprimir JSON con indentación legible")
    args = parser.parse_args()

    output = extract_tables_from_pdf(args.pdf_path)
    
    if args.pretty:
        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(output, ensure_ascii=False))

if __name__ == "__main__":
    main()
