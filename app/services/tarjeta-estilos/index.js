const crypto = require('crypto');
const {getEnvironmentVariable, getProxyUrl, getProxyWhitelist} = require('../../config');
const soap = require('soap');
const fs = require('fs');
const { LogFactory } = require('../../../logger');
const path = require('path');

const baseURL = getEnvironmentVariable("RP3_URL_WS");
const logger = LogFactory.logger();

function getError(error) {

    return JSON.stringify({ name: error.name, message: error.message, stack: error.stack }, null, 2);
}

async function getCardData(request) {
    try {
        
        const url = `${baseURL}/Rp3.Web.Estilos.Ecommerce/ConsultaCredito.asmx?wsdl`;

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


        logger.debug(`Request getCardData XML: ${JSON.stringify(args)}`);

        const client = await soap.createClientAsync(url);

        const result = await client.ObtenerObtenerDatosTarjetaAsync(args);

        const ObtenerObtenerDatosTarjetaResult = result[0]['ObtenerObtenerDatosTarjetaResult']

        if (ObtenerObtenerDatosTarjetaResult) {
            return ObtenerObtenerDatosTarjetaResult
        }

        throw new Error(ObtenerObtenerDatosTarjetaResult);

    } catch (error) {
        logger.debug(`ERROR: ${JSON.stringify(getError(error))}`);

        return {error: getError(error), hasError: true};
    }
}

async function getInstallments(request) {
    try {

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

    
    const url = `${baseURL}/Estilos.ServiceTiendaVirtual/EstilosTiendaVirtual.svc?wsdl`;
    const {cardNumber, cardPassword, billDate,tipoDeferido,installments,dniCustomerCode, billingAddress = {}, products = [], payment, FormaPago,isNiubiz = false, sunatSequential, orderId,paymentType} = request;
    const {TarjetaCuenta:cardAccount}  = await getCardData({dniCustomerCode, card:cardNumber})
    const {firstName, lastName, state, email, phoneNumber} = billingAddress;

    const formattedDate = billDate.split("T")[0];
    const getProductDetalle = (product,idx) => {
        const total = product.total - product.discount ;
        const subTotal = product.subTotal - product.discount;
        let PorcentajeDescuento = 0.00
        if(product.discount) {
            PorcentajeDescuento = Math.floor((product.discount*100)/product.total)
        }

        return `<Detalle NLinea="${idx+1}" Vendedor="15927" CodigoProducto="${product.productId}" Descripcion="${product.description}" Cantidad="${product.quantity}" PorcentajeDescuento="${PorcentajeDescuento}" ValorUnitario="${product.unitValue}" SubTotal1="${subTotal}" ValorDescuento="${product.discount}" SubTotal2="${total}" GravaImpuesto="1" ValorImpuesto="${product.tax}" DescuentoGeneral="${product.discount}" Beneficio="" MetodoCupon="" CuponesAplicados="" />
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
            <tem:EstilosCardUsed>${isNiubiz ? false : true}</tem:EstilosCardUsed>
            <tem:XML>
                <![CDATA[
                    <POS>
                        ${detalles}
                         <Pagos NPago="1" ${isNiubiz ? "CodigoOperador='5'": ""}  FormaPago="${FormaPago}" Cuotas="${installments}" CodigoDocumento="16" NumeroDocumento="${isNiubiz ? "6010100103000009" : cardNumber}" Valor="${payment.total}" AutorizadorTarjeta="${cardPassword}" SubTotal1="${payment.subTotal}" SubTotal2="${payment.totalWithoutTax}" ValorImpuesto="${payment.tax}" TipoDiferido="${tipoDeferido}" Cuenta="${cardAccount}" BancoEmite="1" Observaciones="${orderId}"/>
                         <Cliente IdCliente="${dniCustomerCode}" TipoId="1" Nombre1="${firstName} ${lastName}" DireccionDomicilio="${state}" TelefonoDomicilio1="${phoneNumber}" CorreoElectronico="${email}" />
                    </POS>
                ]]>
            </tem:XML>
            <tem:CardAccount>${isNiubiz ? "" : cardAccount}</tem:CardAccount>
            <tem:CardNumber>${isNiubiz ? "6010100103000009" : cardNumber}</tem:CardNumber>
            <tem:CardPassword>${isNiubiz ? "" : cardPassword}</tem:CardPassword>
            <tem:BillAmount>${payment.total}</tem:BillAmount>
            <tem:BillDate>${formattedDate}</tem:BillDate>
            <tem:PaymentMode>${isNiubiz ? "1" : tipoDeferido}</tem:PaymentMode>
            <tem:PaymentLength>${isNiubiz ? "1" : installments}</tem:PaymentLength>
            <tem:EstilosBussinessId>1</tem:EstilosBussinessId>
            <tem:EstilosTerminalName>PCPRUEBA</tem:EstilosTerminalName>
            <tem:EstilosPrinterName>S\/N</tem:EstilosPrinterName>
            <tem:SunatSerie>1523</tem:SunatSerie>
            <tem:SunatSequential>${sunatSequential}</tem:SunatSequential>
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
                let tipoPago = '';
                switch (tipoDeferido) {
                    case '1':
                      tipoPago = 'SIN INTERES';
                      break;
          
                    case '2':
                      tipoPago = 'EN CUOTAS';
                      break;
          
                    case '3':
                      tipoPago = 'DIFERIDO 90';
                      break;
                  }
                  
                return {
                    authorizationResponse: {
                        "responseCode": "1000",
                        "responseReason": "Pagamento Aprobado",
                        "responseDescription": "Pagamento Aprobado",
                        "authorizationCode": transactionId,
                        "hostTransactionId": transactionId
                    },
                    hostTimestamp: new Date().getTime(),
                    additionalProperties : {...transactionResponse, cardNumber,paymentType, tipoPago,numeroCuotas: installments}
                }
            }

        logger.debug(`MESSAJE: ${JSON.stringify(JSON.stringify(transactionResponse))}`);

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

    logger.debug(`ERROR: ${JSON.stringify(getError(error))}`);

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