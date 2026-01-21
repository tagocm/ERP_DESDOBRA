
import { generateDanfePdf } from '../lib/danfe/pdfService';
import fs from 'fs';
import path from 'path';

const SAMPLE_XML = `
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe versao="4.00" Id="NFe35260103645616000108550010000000141214305040">
      <ide>
        <cUF>35</cUF>
        <cNF>21430504</cNF>
        <natOp>VENDA DE MERCADORIA</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>14</nNF>
        <dhEmi>2026-01-17T00:38:05-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3515152</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>0</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>ERP_DESDOBRA_1.0</verProc>
      </ide>
      <emit>
        <CNPJ>03645616000108</CNPJ>
        <xNome>Martigran Industria de Alimentos Ltda</xNome>
        <xFant>Martigran Industria de Alimentos Ltda</xFant>
        <enderEmit>
          <xLgr>Av. das Nações</xLgr>
          <nro>1000</nro>
          <xBairro>Centro</xBairro>
          <cMun>3515152</cMun>
          <xMun>São Paulo</xMun>
          <UF>SP</UF>
          <CEP>01000000</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
        </enderEmit>
        <IE>745003334110</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>06282930000242</CNPJ>
        <xNome>NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xNome>
        <enderDest>
          <xLgr>Mercurio</xLgr>
          <nro>40</nro>
          <xBairro>Bras</xBairro>
          <cMun>3550308</cMun>
          <xMun>Sao Paulo</xMun>
          <UF>SP</UF>
          <CEP>03007000</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
        </enderDest>
        <indIEDest>1</indIEDest>
        <IE>140916717112</IE>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>1</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>Granola Tradicional 1kg</xProd>
          <NCM>19042000</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>5.0000</qCom>
          <vUnCom>12.0000</vUnCom>
          <vProd>60.00</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>UN</uTrib>
          <qTrib>5.0000</qTrib>
          <vUnTrib>12.0000</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>0.00</vBC>
              <pICMS>0.00</pICMS>
              <vICMS>0.00</vICMS>
            </ICMS00>
          </ICMS>
          <IPI>
            <IPITrib>
               <CST>50</CST>
               <vBC>0.00</vBC>
               <pIPI>0.00</pIPI>
               <vIPI>0.00</vIPI>
            </IPITrib>
          </IPI>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>60.00</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>60.00</vNF>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>9</modFrete>
      </transp>
    </infNFe>
    <protNFe versao="4.00">
        <infProt>
            <tpAmb>2</tpAmb>
            <verAplic>SP_NFE_PL_008i2</verAplic>
            <chNFe>35260103645616000108550010000000141214305040</chNFe>
            <dhRecbto>2026-01-17T00:38:07-03:00</dhRecbto>
            <nProt>135260000000000</nProt>
            <digVal>T61DAjnfT6fHzSvu2xG9ZX/iyyM=</digVal>
            <cStat>100</cStat>
            <xMotivo>Autorizado o uso da NF-e</xMotivo>
        </infProt>
    </protNFe>
  </NFe>
</nfeProc>
`;

async function main() {
    try {
        console.log('Generating DANFE PDF...');
        const pdfBuffer = await generateDanfePdf(SAMPLE_XML);
        const outputPath = path.resolve(process.cwd(), 'danfe_test.pdf');
        fs.writeFileSync(outputPath, pdfBuffer);
        console.log(`PDF Generated successfully: ${outputPath}`);
    } catch (e) {
        console.error('Error generating PDF:', e);
        process.exit(1);
    }
}

main();
