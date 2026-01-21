export function buildSoapEnvelope(bodyContent: string, uf: string = 'SP', service: string = 'NFeAutorizacao4'): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${service}">${bodyContent}</nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

export function buildSoapEnvelopeRet(bodyContent: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
      ${bodyContent}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}
