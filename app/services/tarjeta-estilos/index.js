const crypto = require('crypto');
const axios = require('axios');
const {getEnvironmentVariable} = require('../../config');
const {getSQLTarifario} = require("../SqlServer")
const xml2js = require('xml2js');
const format = require('date-fns/format')
var soap = require('soap');
const {getAmount} = require("../utils")


const parser = new xml2js.Parser({
  explicitArray: false,
  tagNameProcessors: [xml2js.processors.stripPrefix]
});

const parseString = parser.parseStringPromise;

async function getCardData(request) {

    try {
        const baseURL = getEnvironmentVariable("RP3_URL_WS");

        const {dniCustomerCode, companyCode = 1, card, password = ""} = request;

        const hash = crypto.createHash('md5').update(password).digest('hex');

        const xmlBody = `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
            <soapenv:Header/>
            <soapenv:Body>
                <tem:ObtenerObtenerDatosTarjeta>
                <tem:req>
                    <tem:Codigo>${dniCustomerCode}</tem:Codigo>
                    <tem:Empresa>${companyCode}</tem:Empresa>
                    <tem:Cuenta>?</tem:Cuenta>
                    <tem:Usuario>?</tem:Usuario>
                    <tem:PcName>?</tem:PcName>
                    <tem:Tarjeta>${card}</tem:Tarjeta>
                    <tem:TarjetaBin>?</tem:TarjetaBin>
                    <tem:ClaveDigitada>${hash}</tem:ClaveDigitada>
                </tem:req>
                </tem:ObtenerObtenerDatosTarjeta>
            </soapenv:Body>
            </soapenv:Envelope>
        `;

        const {data} = await axios({
            url: `${baseURL}/Rp3.Web.Estilos.Ecommerce/ConsultaCredito.asmx?op=ObtenerObtenerDatosTarjeta`,
            method: 'POST',
            data: xmlBody,
            headers: {
                'Content-Type':'text/xml;charset=utf-8',
                'Content-Length':xmlBody.length,
            }
        });

        const parsedXMLResponse = await parseString(data);
        const jsonResponse = parsedXMLResponse['Envelope']['Body']['ObtenerObtenerDatosTarjetaResponse'];
        if (jsonResponse['ObtenerObtenerDatosTarjetaResult']) {

            const tarjetaData = jsonResponse['ObtenerObtenerDatosTarjetaResult']
            const hasError = jsonResponse["HuboError"]
            if(hasError) {
                const message = jsonResponse["Mensaje"]
                return {error: {message}, hasError: true};
            }
            return tarjetaData
        }

    } catch (error) {
        return {error, hasError: true};
    }
}

async function getInstallments(request) {

    try {
        const baseURL = getEnvironmentVariable("RP3_URL_WS");

        const {orderValue, formaDePago, plazo, numeroCuetaCliente, numeroCuota} = request;
        const mesesDiferido = formaDePago === 3 ? 2 : 0;

        const xmlBody = `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
            <soapenv:Header/>
            <soapenv:Body>
                <tem:SimuladorCuotas>
                <tem:req>
                    <tem:Codigo>0</tem:Codigo>
                    <tem:Empresa>?</tem:Empresa>
                    <tem:Cuenta>?</tem:Cuenta>
                    <tem:Usuario>?</tem:Usuario>
                    <tem:PcName>?</tem:PcName>
                    <tem:Tarjeta>?</tem:Tarjeta>
                    <tem:TarjetaBin>?</tem:TarjetaBin>
                    <tem:Capital>${orderValue}</tem:Capital>
                    <tem:TasaInteres>0</tem:TasaInteres>
                    <tem:Plazo>${plazo}</tem:Plazo>
                    <tem:MesesDiferido>${mesesDiferido}</tem:MesesDiferido>
                    <tem:NumeroCuota>${numeroCuota}</tem:NumeroCuota>
                    <tem:CuotaValorCapital>${formaDePago}</tem:CuotaValorCapital>
                    <tem:CuotaValorIC>${numeroCuetaCliente}</tem:CuotaValorIC>
                    <tem:CuotaValorICD>0</tem:CuotaValorICD>
                    <tem:CuotaValorCIC>0</tem:CuotaValorCIC>
                    <tem:TotalValorIC>0</tem:TotalValorIC>
                </tem:req>
                </tem:SimuladorCuotas>
            </soapenv:Body>
            </soapenv:Envelope>
        `;


        const {data} = await axios({
            url: `${baseURL}/Rp3.Web.Estilos.Ecommerce/Operacion.asmx?WSDL`,
            method: 'POST',
            data: xmlBody,
            headers: {
                'Content-Type':'text/xml;charset=utf-8',
                'Content-Length':xmlBody.length,
            }
        });

        const parsedXMLResponse = await parseString(data);
        const jsonResponse = parsedXMLResponse['Envelope']['Body']['SimuladorCuotasResponse'];
        if (jsonResponse['SimuladorCuotasResult']) {
            return jsonResponse['SimuladorCuotasResult']
        }

        throw new Error(jsonResponse);
        

    } catch (error) {
        return {error, hasError: true};
    }
}

async function getTarifario(tarjeta) {
    try {
        const tarifario = await getSQLTarifario(tarjeta)
        
        return tarifario
    } catch (error) {
        throw new Error(error);        
    }
}


async function getTransactionEstilosCard(request) {


try {
    const baseURL = getEnvironmentVariable("RP3_URL_WS");
    const url = `${baseURL}/Estilos.AppPagos/EstilosTiendaVirtual.svc?wsdl`;
    const estilosTerminalName = getEnvironmentVariable("RP3_TERMINAL_NAME");
    const {cardAccount, cardNumber, cardPassword, billDate,paymentMethod,installments,dniCustomerCode, billingAddress = {}, products = [], payment, paymentForm} = request;
    const {firstName, lastName, state, email, phoneNumber} = billingAddress;
    const formattedDate = billDate.split("T")[0];
    const getProductDetalle = (product,idx) => {
        return `<Detalle NLinea="${idx}" CodigoProducto="${product.productId}" Descripcion="${product.description}" Cantidad="${product.quantity}" PorcentajeDescuento="0.00" ValorUnitario="${product.unitValue}" SubTotal1="${product.subTotal}" ValorDescuento="0" SubTotal2="${product.subTotal}" GravaImpuesto="1" ValorImpuesto="${product.tax}" DescuentoGeneral="0" Beneficio="" MetodoCupon="" CuponesAplicados="" />
        `
    }
    let detalles = "";
    products.forEach((product,idx) => {
        detalles= `${detalles} ${getProductDetalle(product, idx)}`
    });

    const xmlBody = `
        <tem:TransactionRegistration xmlns:tem="http://tempuri.org/">
            <tem:BillType>BO</tem:BillType>
            <tem:EstilosUserName>EstilosOnline</tem:EstilosUserName>
            <tem:EstilosStoreId>35</tem:EstilosStoreId>
            <tem:EstilosCashierId>1</tem:EstilosCashierId>
            <tem:EstilosCardUsed>true</tem:EstilosCardUsed>
            <tem:XML>
                <![CDATA[
                    <POS>
                        ${detalles}
                         <Pagos NPago="1" FormaPago="${paymentForm}" Cuotas="${installments}" CodigoDocumento="16" NumeroDocumento="${cardNumber}" Valor="${payment.total}" AutorizadorTarjeta="${cardPassword}" SubTotal1="${payment.subTotal}" SubTotal2="${payment.subTotal}" ValorImpuesto="${payment.tax}" TipoDiferido="${paymentMethod}" Cuenta="${cardAccount}" BancoEmite="1" />
                        <Cliente IdCliente="${dniCustomerCode}" TipoId="1" Nombre1="${firstName} ${lastName}" DireccionDomicilio="${state}" TelefonoDomicilio1="${phoneNumber}" CorreoElectronico="${email}" />
                        </POS>
                ]]>
            </tem:XML>
            <tem:CardAccount>${cardAccount}</tem:CardAccount>
            <tem:CardNumber>${cardNumber}</tem:CardNumber>
            <tem:CardPassword>${cardPassword}</tem:CardPassword>
            <tem:BillAmount>${payment.total}</tem:BillAmount>
            <tem:BillDate>${formattedDate}</tem:BillDate>
            <tem:PaymentMode>${paymentMethod}</tem:PaymentMode>
            <tem:PaymentLength>${installments}</tem:PaymentLength>
            <tem:EstilosBussinessId>1</tem:EstilosBussinessId>
            <tem:EstilosTerminalName>${estilosTerminalName}</tem:EstilosTerminalName>
            <tem:EstilosPrinterName>S\/N</tem:EstilosPrinterName>
            <tem:SunatSerie>1523</tem:SunatSerie>
            <tem:SunatSequential>55042</tem:SunatSequential>
            <tem:modoCaptura />
            <tem:TipoIdentificacion>1</tem:TipoIdentificacion>
            <tem:IdDocumentoCliente>${dniCustomerCode}</tem:IdDocumentoCliente>
        </tem:TransactionRegistration>`;

    const client = await soap.createClientAsync(url);
    const result = await client.TransactionRegistrationAsync({_xml : xmlBody});

    const transactionRegistrationResult = result[0]['TransactionRegistrationResult']
        if (transactionRegistrationResult) {

            const transactionResponse = transactionRegistrationResult
            const transactionId = transactionResponse["TransactionId"]
            const success = transactionResponse["Success"]
            const message = transactionResponse["Message"]
            if (success !== "false") {
                return {
                    authorizationResponse: {
                        "responseCode": "1000",
                        "responseReason": "Pagamento Aprobado",
                        "responseDescription": "Pagamento Aprobado",
                        "authorizationCode": transactionId,
                        "hostTransactionId": transactionId
                    },
                    hostTimestamp: new Date().getTime()
                }
            }

            return {
                authorizationResponse: {
                    "responseCode": "9000",
                    "responseReason": message,
                    "responseDescription": message,
                    "authorizationCode": "error",
                    "hostTransactionId": "error"
                },
                hostTimestamp: new Date().getTime()
            }

        }

    throw new Error(null);
} catch (error) {
    return {
        authorizationResponse: {
            "responseCode" : "9000",
            "responseReason" : "Estilos Card Pagamento Recusado",
            "responseDescription" :  "Estilos Pagamento Recusado",
            "authorizationCode" : "error",
            "hostTransactionId" : "error"
        },
        hostTimestamp : new Date().getTime()
    }
}

}

module.exports = {
    getCardData,
    getInstallments,
    getTarifario,
    getTransactionEstilosCard
 };
 
