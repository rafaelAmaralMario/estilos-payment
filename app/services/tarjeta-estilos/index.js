const crypto = require('crypto');
const {getEnvironmentVariable, axiosRequest: axios} = require('../../config');
const xml2js = require('xml2js');
var soap = require('soap');

async function getCardData(request) {
    try {
        const baseURL = getEnvironmentVariable("RP3_URL_WS");

        const {dniCustomerCode, companyCode = 1, card, password = ""} = request;

        const hash = crypto.createHash('md5').update(password).digest('hex');

        const args = {
            req : {
                Codigo: dniCustomerCode,
                Empresa: companyCode,
                Cuenta: "?",
                Usuario: "?",
                PcName: "?",
                Tarjeta: card,
                TarjetaBin: "?",
                ClaveDigitada: hash
            }
        }

        const url = `${baseURL}/Rp3.Web.Estilos.Ecommerce/ConsultaCredito.asmx?wsdl`;

        const client = await soap.createClientAsync(url);

        const result = await client.ObtenerObtenerDatosTarjetaAsync(args);

        const ObtenerObtenerDatosTarjetaResult = result[0]['ObtenerObtenerDatosTarjetaResult']

        if (ObtenerObtenerDatosTarjetaResult) {
            return ObtenerObtenerDatosTarjetaResult
        }

        throw new Error(ObtenerObtenerDatosTarjetaResult);

    } catch (error) {
        return {error, hasError: true};
    }
}

async function getInstallments(request) {
    try {
        const baseURL = getEnvironmentVariable("RP3_URL_WS");

        const {orderValue, formaDePago, plazo, numeroCuetaCliente, numeroCuota} = request;
        const mesesDiferido = formaDePago === 3 ? 2 : 0;
        const args = {
            req: {
                Codigo: "0",
                Empresa: "?",
                Cuenta: "?",
                Usuario: "?",
                PcName: "?",
                Tarjeta: "?",
                TarjetaBin: "?",
                Capital: orderValue,
                TasaInteres: "0",
                Plazo: plazo,
                MesesDiferido: mesesDiferido,
                NumeroCuota: numeroCuota,
                CuotaValorCapital: formaDePago,
                CuotaValorIC: numeroCuetaCliente,
                CuotaValorICD: "0",
                CuotaValorCIC: "0",
                TotalValorIC: "0",
            }
        }
       
        const url = `${baseURL}/Rp3.Web.Estilos.Ecommerce/Operacion.asmx?wsdl`;

        const client = await soap.createClientAsync(url);

        const result = await client.SimuladorCuotasAsync(args);

        const SimuladorCuotasResult = result[0]['SimuladorCuotasResult']

        if (SimuladorCuotasResult) {
            return SimuladorCuotasResult
        }

        throw new Error(SimuladorCuotasResult);
  
    } catch (error) {
        return {error, hasError: true};
    }
}

async function getTarifario(tarjeta) {
    try {
        const baseURL = getEnvironmentVariable("RP3_URL_WS");
        const url = `${baseURL}/Estilos.ServiceTiendaVirtual/EstilosTiendaVirtual.svc?wsdl`;

        const client = await soap.createClientAsync(url);
        const result = await client.mxConsultaTarifarioAsync({"tcTarjeta" : tarjeta});

        const mxConsultaTarifarioResult = result[0]['mxConsultaTarifarioResult']

        if (mxConsultaTarifarioResult) {
            return mxConsultaTarifarioResult["EConsultaTarifarioES"]
        }

        throw new Error(mxConsultaTarifarioResult);

    } catch (error) {
        return {error, hasError: true};
    }
}

async function getTransactionEstilosCard(request) {

try {
    const baseURL = getEnvironmentVariable("RP3_URL_WS");
    const url = `${baseURL}/Estilos.ServiceTiendaVirtual/EstilosTiendaVirtual.svc?wsdl`;
    const {cardAccount, cardNumber, cardPassword, billDate,tipoDeferido,installments,dniCustomerCode, billingAddress = {}, products = [], payment, FormaPago} = request;
    const {firstName, lastName, state, email, phoneNumber} = billingAddress;
    const formattedDate = billDate.split("T")[0];
    const getProductDetalle = (product,idx) => {
        return `<Detalle NLinea="${idx+1}" Vendedor="15927" CodigoProducto="${product.productId}" Descripcion="${product.description}" Cantidad="${product.quantity}" PorcentajeDescuento="0.00" ValorUnitario="${product.unitValue}" SubTotal1="${product.subTotal}" ValorDescuento="${product.discount}" SubTotal2="${product.total}" GravaImpuesto="1" ValorImpuesto="${product.tax}" DescuentoGeneral="0" Beneficio="" MetodoCupon="" CuponesAplicados="" />
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
                         <Pagos NPago="1" FormaPago="${FormaPago}" Cuotas="${installments}" CodigoDocumento="16" NumeroDocumento="${cardNumber}" Valor="${payment.total}" AutorizadorTarjeta="${cardPassword}" SubTotal1="${payment.subTotal}" SubTotal2="${payment.totalWithoutTax}" ValorImpuesto="${payment.tax}" TipoDiferido="${tipoDeferido}" Cuenta="${cardAccount}" BancoEmite="1" />
                        <Cliente IdCliente="${dniCustomerCode}" TipoId="1" Nombre1="${firstName} ${lastName}" DireccionDomicilio="${state}" TelefonoDomicilio1="${phoneNumber}" CorreoElectronico="${email}" />
                        </POS>
                ]]>
            </tem:XML>
            <tem:CardAccount>${cardAccount}</tem:CardAccount>
            <tem:CardNumber>${cardNumber}</tem:CardNumber>
            <tem:CardPassword>${cardPassword}</tem:CardPassword>
            <tem:BillAmount>${payment.total}</tem:BillAmount>
            <tem:BillDate>${formattedDate}</tem:BillDate>
            <tem:PaymentMode>${tipoDeferido}</tem:PaymentMode>
            <tem:PaymentLength>${installments}</tem:PaymentLength>
            <tem:EstilosBussinessId>1</tem:EstilosBussinessId>
            <tem:EstilosTerminalName>PCPRUEBA</tem:EstilosTerminalName>
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
 
