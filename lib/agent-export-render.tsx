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
function pdfSections(sections: Section[], includeEmpty = false) {
  return sections.flatMap(section => {
    if (section.rows.length === 0 && !includeEmpty) return []
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
function ScopeCard({scope}:{scope:NonNullable<ExportModel['scope']>}) {
  return <View style={{backgroundColor:'#eff6ff',borderRadius:7,padding:12,marginVertical:10}} wrap={false}>
    <Text style={{fontSize:10,fontFamily:'Helvetica-Bold',marginBottom:8}}>PÉRIMÈTRE DU RAPPORT</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap'}}>{scope.map(item=><View key={item.label} style={{width:'50%',paddingRight:15,marginBottom:7}}><Text style={{fontSize:7,color:'#64748b',marginBottom:3}}>{item.label}</Text><Text style={{fontSize:9,fontFamily:'Helvetica-Bold'}}>{display(item.value)}</Text></View>)}</View>
  </View>
}
function PdfRows({section}:{section:Section}) {
  return <>{section.rows.length===0?<Text>Aucune donnée sur cette sélection.</Text>:section.rows.map((row,i)=><View key={i} wrap={section.title==='Informations'} style={[styles.row,{backgroundColor:i%2?'#f8fafc':'#ffffff'}]}>{section.columns.map(c=><Text key={c.key} style={[styles.cell,{textAlign:c.money || c.key==='value' || c.key==='value2'?'right':'left'}]}>{display(row[c.key])}</Text>)}</View>)}</>
}
export async function renderAgentPdf(model: ExportModel) {
  const scopeLine=model.scope?.map(s=>`${s.label} : ${s.value}`).join(' | ')
  return renderToBuffer(<Document title={model.title} author="PADES — PERCOM">
    {model.scope && model.sections[0]?.title!=='Synthèse' && <Page size="A4" orientation="landscape" style={[styles.page,{paddingTop:30}]}>
      <Text style={styles.title}>PADES / PERCOM — {model.title}</Text><Text style={styles.subtitle}>{model.agent} | {model.period} | FCFA</Text><Text style={styles.subtitle}>{model.status}</Text>
      <ScopeCard scope={model.scope}/><Text style={styles.heading}>{model.selectionLabel || 'Rapport complet'}</Text>
      {model.sections.map(s=><Text key={s.title} style={{marginBottom:8}}>{s.title} · {s.rows.length} ligne(s)</Text>)}
      <Text style={styles.footer} fixed render={({pageNumber,totalPages})=>`Édité le ${model.generated} (Lomé) · Page ${pageNumber} / ${totalPages}`}/>
    </Page>}
    {pdfSections(model.sections,!!model.scope).map((section,index)=>{
      const cover=!!model.scope && index===0 && section.title==='Synthèse'
      return <Page key={index} size="A4" orientation="landscape" style={[styles.page,{paddingTop:cover?25:model.scope?180:133}]} wrap>
        <View style={cover?{}:styles.header} fixed={!cover}>
          <Text style={styles.title}>PADES / PERCOM — {model.title}</Text>
          <Text style={styles.subtitle}>{model.agent} | {model.period} | Montants en FCFA</Text>
          <Text style={[styles.subtitle,{color:model.status.startsWith('OFFICIEL')?'#166534':'#92400e',fontFamily:'Helvetica-Bold'}]}>{model.status}</Text>
          {cover && model.scope?<ScopeCard scope={model.scope}/>:scopeLine?<View style={{backgroundColor:'#eff6ff',padding:8,borderRadius:4,marginTop:4}}><Text style={{fontSize:8,lineHeight:1.4}}>{display(scopeLine)}</Text></View>:null}
          <Text style={styles.heading}>{section.title}{model.selectionLabel ? ` · ${model.selectionLabel}` : ''}</Text>
          <View style={[styles.row,{backgroundColor:'#dbeafe',fontFamily:'Helvetica-Bold'}]}>{section.columns.map(c=><Text key={c.key} style={styles.cell}>{c.label}{c.money?' (F)':''}</Text>)}</View>
        </View>
        <PdfRows section={section}/>
        <Text style={styles.footer} fixed render={({pageNumber,totalPages})=>`Édité le ${model.generated} (Lomé) · — : non renseigné / non applicable · Page ${pageNumber} / ${totalPages}`}/>
      </Page>
    })}
  </Document>)
}
export async function renderAgentExcel(model: ExportModel) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PADES — PERCOM'; workbook.created = new Date()
  for (const [sectionIndex, section] of model.sections.entries()) {
    const sheet = workbook.addWorksheet(model.scope && sectionIndex===0 && section.title==='Synthèse' ? 'Synthèse & périmètre' : section.title, { views: [{ state: 'frozen', ySplit: 6 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } })
    const width = section.columns.length
    const mergedRow = (value: string) => { const row = sheet.addRow([value]); if (width > 1) sheet.mergeCells(row.number, 1, row.number, width); return row }
    mergedRow(`PADES / PERCOM — ${model.title}`).font = { bold: true, size: 16, color: { argb: 'FF172554' } }
    mergedRow(`${model.agent} · ${model.period} · FCFA`)
    mergedRow(model.status).font = { bold: true, color: { argb: model.status.startsWith('OFFICIEL') ? 'FF166534' : 'FF92400E' } }
    mergedRow(`Édité le ${model.generated} (Lomé). Cellule vide : non renseigné ou non applicable.`)
    if (model.scope) {
      const scopeHeading=mergedRow('PÉRIMÈTRE DU RAPPORT')
      scopeHeading.font={bold:true,color:{argb:'FF1D4ED8'},size:11}
      scopeHeading.height=24
      for (const item of model.scope) {
        const row=sheet.addRow([item.label,item.value])
        if(width>2)sheet.mergeCells(row.number,2,row.number,width)
        row.height=Math.max(28,16*Math.ceil(item.value.length/75))
        row.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEFF6FF'}};cell.alignment={wrapText:true,vertical:'middle'}})
        row.getCell(1).font={bold:true,color:{argb:'FF475569'}}
      }
      mergedRow(`Rattachements actuels · ${model.selectionLabel || 'Rapport complet'} du périmètre sélectionné`).font={italic:true,color:{argb:'FF64748B'},size:10}
    }
    mergedRow(section.title).font = { bold: true, size: 12 }
    const header = sheet.addRow(section.columns.map(c => c.label + (c.money ? ' (FCFA)' : '')))
    sheet.views=[{state:'frozen',ySplit:header.number,showGridLines:!model.scope}]
    header.height = 32
    header.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A4E94' } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { wrapText: true, vertical: 'middle' } })
    for (const row of section.rows) {
      // Strings stay strings: ExcelJS only creates formulas from explicit formula objects.
      const added = sheet.addRow(section.columns.map(c => row[c.key] ?? null))
      if(model.scope) added.height=24
      added.eachCell((cell, col) => { cell.alignment = { vertical: 'top', wrapText: true }; if (typeof cell.value === 'number') cell.numFmt = model.scope ? (Number.isInteger(cell.value) ? '#,##0' : '#,##0.00') : '#,##0.##'; if (added.number % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; if (section.columns[col - 1].money) cell.numFmt = model.scope && Number.isInteger(cell.value) ? '#,##0' : '#,##0.00' })
    }
    section.columns.forEach((c, i) => { sheet.getColumn(i + 1).width = c.key === 'label' || c.key === 'value' || c.key === 'commentaire' || c.key === 'motif' ? 44 : c.key === 'nom_prenom' || c.key === 'nom_client' ? 28 : 20 })
    if (section.rows.length) sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number + section.rows.length, column: width } }
    sheet.pageSetup.printTitlesRow = `1:${header.number}`
    if(model.scope) {
      sheet.getRow(1).height=34
      for(const n of [2,3,4])sheet.getRow(n).height=24
      for(const n of [1,2,3,4])sheet.getRow(n).alignment={vertical:'middle',wrapText:true}
      sheet.headerFooter.oddFooter='PADES / PERCOM | Page &P / &N'
    }
  }
  return workbook.xlsx.writeBuffer()
}
