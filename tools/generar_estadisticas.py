"""Genera datos agregados para estadistica.html sin dependencias externas."""

import argparse
from collections import Counter
from datetime import datetime, timedelta
import json
from pathlib import Path
import posixpath
import re
import unicodedata
from xml.etree import ElementTree as ET
from zipfile import ZipFile


NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def normalize(value):
    return " ".join(value.split())


def read_rows(path):
    with ZipFile(path) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            strings = [
                "".join(item.itertext()) for item in root.findall("s:si", NS)
            ]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        properties = workbook.find("s:workbookPr", NS)
        date1904 = properties is not None and properties.get("date1904") in ("1", "true")
        relations = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {item.get("Id"): item.get("Target") for item in relations}
        sheet = workbook.find("s:sheets/s:sheet", NS)
        target = targets[sheet.get(REL)]
        target = target.lstrip("/") if target.startswith("/") else posixpath.normpath("xl/" + target)
        document = ET.fromstring(archive.read(target))
        rows = []
        for row in document.findall("s:sheetData/s:row", NS):
            values = {}
            for cell in row.findall("s:c", NS):
                value = cell.findtext("s:v", default="", namespaces=NS)
                if cell.get("t") == "s":
                    value = strings[int(value)]
                elif cell.get("t") == "inlineStr":
                    value = "".join(cell.find("s:is", NS).itertext())
                values[re.sub(r"\d", "", cell.get("r"))] = normalize(value)
            rows.append(values)
        return rows, date1904


def pairs(counter):
    return [{"label": key, "value": value} for key, value in sorted(counter.items())]


def chain_stats(rows, date1904):
    records = []
    for row in rows:
        if row.get("B", "").startswith("PERIODO"):
            break
        match = re.match(r"^(PSVG-[A-Z]+-\d+/\d{4})(.*)$", row.get("B", ""))
        if match:
            records.append((match.group(1), bool(match.group(2)), row))
    initial = Counter()
    compliance = Counter()
    outcomes = Counter()
    years = Counter()
    for case, is_compliance, row in records:
        (compliance if is_compliance else initial)[case[-4:]] += 1
        outcome = row.get("D", "")
        label = {
            "Existencia": "Existencia",
            "Inexistencia": "Inexistencia",
            "Existencia/ Inexistencia": "Existencia / Inexistencia",
            "Pendiente": "Pendiente",
            "NA": "NA (sin información)",
            "": "Sin dato",
        }.get(outcome)
        if label is None:
            raise ValueError(f"Sentido desconocido: {outcome}")
        outcomes[label] += 1
        date = row.get("C", "")
        if re.fullmatch(r"\d+(?:\.\d+)?", date):
            base = datetime(1904, 1, 1) if date1904 else datetime(1899, 12, 30)
            years[str((base + timedelta(days=float(date))).year)] += 1
        elif date not in ("NA", "Pendiente", ""):
            raise ValueError(f"Fecha no reconocida: {date}")
    return {
        "records": len(records),
        "cases": len({case for case, _, _ in records}),
        "compliance": sum(compliance.values()),
        "dated": sum(years.values()),
        "initialByYear": pairs(initial),
        "complianceByYear": pairs(compliance),
        "sentencesByYear": pairs(years),
        "outcomes": pairs(outcomes),
    }


def detail_stats(rows):
    periods = {}
    period = None
    for row in rows:
        title = row.get("B", "")
        if title.startswith("PERIODO "):
            period = title.split()[-1]
            periods[period] = []
        elif period and re.match(r"^PSVG-", title):
            periods[period].append(row)
    result = {}
    for key, records in [("todos", sum(periods.values(), [])), *periods.items()]:
        qualities = Counter()
        behaviors = Counter()
        missing = 0
        for row in records:
            quality = row.get("C", "")
            qualities[{
                "": "Sin dato",
                "CIUDADANA": "Ciudadana",
                "CIUDADANA/SERVIDORA PUBLICA": "Ciudadana / servidora pública",
            }[quality]] += 1
            behavior = row.get("D", "")
            if not behavior:
                missing += 1
                continue
            plain = "".join(
                char for char in unicodedata.normalize("NFD", behavior.lower())
                if unicodedata.category(char) != "Mn"
            )
            categories = {
                "psicologica": "Psicológica",
                "digital": "Digital",
                "simbolica": "Simbólica",
                "politica": "Política",
                "economica": "Económica",
                "obstruccion": "Obstrucción en ejercicio del cargo",
            }
            found = [label for token, label in categories.items() if token in plain]
            if not found:
                raise ValueError(f"Conducta no reconocida: {behavior}")
            behaviors.update(found)
        result[key] = {
            "records": len(records),
            "qualities": pairs(qualities),
            "behaviors": pairs(behaviors),
            "missingBehaviors": missing,
        }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ttug", required=True, type=Path)
    parser.add_argument("--psvg", required=True, type=Path)
    parser.add_argument(
        "--output", type=Path,
        default=Path(__file__).resolve().parents[1] / "assets/js/estadistica-datos.js",
    )
    args = parser.parse_args()
    ttug, ttug1904 = read_rows(args.ttug)
    psvg, psvg1904 = read_rows(args.psvg)
    data = {
        "sources": {
            "ttug": {"name": args.ttug.name, **chain_stats(ttug, ttug1904)},
            "psvg": {"name": args.psvg.name, **chain_stats(psvg, psvg1904)},
        },
        "details": detail_stats(psvg),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        "// Generado por tools/generar_estadisticas.py; no editar manualmente.\n"
        "window.estadisticaDatos = "
        + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    for source in data["sources"].values():
        print(f'{source["name"]}: {source["records"]} registros; '
              f'{source["cases"]} expedientes; {source["compliance"]} cumplimentadoras; '
              f'{source["dated"]} con fecha de sentencia.')
    for period, detail in data["details"].items():
        print(f'Detalle {period}: {detail["records"]} registros; '
              f'{detail["missingBehaviors"]} sin conducta.')


if __name__ == "__main__":
    main()
