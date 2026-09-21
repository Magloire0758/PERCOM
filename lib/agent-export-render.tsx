import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import ExcelJS from 'exceljs'
import { formatNumber } from './agent-reporting'
import type { ExportModel, Section } from './agent-export-model'

const styles = StyleSheet.create({ page: { paddingTop: 133, paddingBottom: 40, paddingHorizontal: 30, fontFamily: 'Helvetica', fontSize: 8, color: '#172554' }, header: { position: 'absolute', top: 24, left: 30, right: 30 }, title: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginBottom: 5 }, subtitle: { fontSize: 9, marginBottom: 4 }, heading: { fontSize: 11, marginTop: 9, marginBottom: 7, fontFamily: 'Helvetica-Bold' }, row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1' }, cell: { padding: 5, flexGrow: 1, flexBasis: 0 }, footer: { position: 'absolute', bottom: 16, left: 30, right: 30, fontSize: 7, color: '#64748b' } })
function display(value: unknown) {
  const text = value == null ? '—' : typeof value === 'boolean' ? value ? 'Oui' : 'Non' : typeof value === 'number' ? formatNumber(value) : String(value)
  return text.replace(/[\u202f\u00a0]/g, ' ')
}
// Wide journal remains one worksheet. PDF splits it into readable panels, each with its date column.
function pdfSections(sections: Section[]) {
  return sections.flatMap(section => {
    if (section.rows.length === 0) return []
    if (section.title === 'Synthèse') {
      const rows = []
      for (let i = 0; i < section.rows.length; i += 2) rows.push({ ...section.rows[i], label2: section.rows[i + 1]?.label ?? '', value2: section.rows[i + 1]?.value ?? '', unit2: section.rows[i + 1]?.unit ?? '' })
      return [{ ...section, rows, columns: [...section.columns, ...section.columns.map(c => ({ ...c, key: c.key + '2' }))] }]
    }
    if (section.columns.length <= 10) return [section]
    const identity = section.columns.filter((c, i) => i === 0 || c.key === 'membre')
    const columns = section.columns.filter(c => !identity.includes(c))
    const result: Section[] = []
    for (let i = 0; i < columns.length; i += 8) result.push({ ...section, title: `${section.title} — volet ${Math.floor(i / 8) + 1}`, columns: [...identity, ...columns.slice(i, i + 8)] })
    return result
  })
}
export async function renderAgentPdf(model: ExportModel) {
  return renderToBuffer(<Document title={model.title} author="PADES — PERCOM">
    {pdfSections(model.sections).map((section, index) => <Page key={index} size="A4" orientation="landscape" style={styles.page} wrap>
      <View style={styles.header} fixed>
        <Text style={styles.title}>PADES / PERCOM — {model.title}</Text>
        <Text style={styles.subtitle}>{model.agent} | {model.period} | FCFA</Text>
        <Text style={styles.subtitle}>{model.status}</Text>
        <Text style={styles.heading}>{section.title}</Text>
        <View style={[styles.row, { backgroundColor: '#e2e8f0', fontFamily: 'Helvetica-Bold' }]}>{section.columns.map(c => <Text key={c.key} style={styles.cell}>{c.label}{c.money ? ' (F)' : ''}</Text>)}</View>
      </View>
      {section.rows.length === 0 ? <Text>Aucune donnée sur cette sélection.</Text> : section.rows.map((row, i) => <View key={i} wrap={section.title === 'Informations'} style={[styles.row, { backgroundColor: i % 2 ? '#f8fafc' : '#ffffff' }]}>{section.columns.map(c => <Text key={c.key} style={styles.cell}>{display(row[c.key])}</Text>)}</View>)}
      <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `Édité le ${model.generated} (Lomé) · — : non renseigné / non applicable · Page ${pageNumber} / ${totalPages}`} />
    </Page>)}
  </Document>)
}
export async function renderAgentExcel(model: ExportModel) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PADES — PERCOM'; workbook.created = new Date()
  for (const section of model.sections) {
    const sheet = workbook.addWorksheet(section.title, { views: [{ state: 'frozen', ySplit: 6 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } })
    const width = section.columns.length
    const mergedRow = (value: string) => { const row = sheet.addRow([value]); if (width > 1) sheet.mergeCells(row.number, 1, row.number, width); return row }
    mergedRow(`PADES / PERCOM — ${model.title}`).font = { bold: true, size: 16, color: { argb: 'FF172554' } }
    mergedRow(`${model.agent} · ${model.period} · FCFA`)
    mergedRow(model.status).font = { bold: true, color: { argb: model.status.startsWith('OFFICIEL') ? 'FF166534' : 'FF92400E' } }
    mergedRow(`Édité le ${model.generated} (Lomé). Cellule vide : non renseigné ou non applicable.`)
    mergedRow(section.title).font = { bold: true, size: 12 }
    const header = sheet.addRow(section.columns.map(c => c.label + (c.money ? ' (FCFA)' : '')))
    header.height = 32
    header.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A4E94' } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { wrapText: true, vertical: 'middle' } })
    for (const row of section.rows) {
      // Strings stay strings: ExcelJS only creates formulas from explicit formula objects.
      const added = sheet.addRow(section.columns.map(c => row[c.key] ?? null))
      added.eachCell((cell, col) => { cell.alignment = { vertical: 'top', wrapText: true }; if (typeof cell.value === 'number') cell.numFmt = '#,##0.##'; if (added.number % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; if (section.columns[col - 1].money) cell.numFmt = '#,##0.00' })
    }
    section.columns.forEach((c, i) => { sheet.getColumn(i + 1).width = c.key === 'label' || c.key === 'value' || c.key === 'commentaire' || c.key === 'motif' ? 44 : c.key === 'nom_prenom' || c.key === 'nom_client' ? 28 : 20 })
    if (section.rows.length) sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6 + section.rows.length, column: width } }
    sheet.pageSetup.printTitlesRow = '1:6'
  }
  return workbook.xlsx.writeBuffer()
}
