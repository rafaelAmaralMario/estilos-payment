<?php

namespace App\Http\Controllers;

use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OracleController extends Controller
{

    private $baseUrl;
    private $userTest;
    private $password;

    public function __construct()
    {
        $this->baseUrl = config('services.niubiz.url_base');
        $this->userTest = config('services.niubiz.user_test');
        $this->password = config('services.niubiz.password');
    }

    private function getApiToken()
    {
        $header = ['Content-Type: application/json'];
        $ch = curl_init();

        curl_setopt($ch, CURLOPT_URL, $this->baseUrl);
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_USERPWD, "$this->userTest:$this->password");
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $key = curl_exec($ch);
        if ($key !== 'Unauthorized access') {
            $this->token = $key;
            return $key;
        } else {
            die($key);
        }
    }


    public function payment(Request $request)
    {
        Log::info('Inicianding process of payment');

        $cardObject = [
            "cardNumber" => $request->cardDetails['number'],
            "expirationMonth" => $request->cardDetails['expirationMonth'],
            "expirationYear" => $request->cardDetails['expirationYear'],
            "cvv2" => $request->cardDetails['cvv'],
            "holderName" => $request->cardDetails['holderName'],
            "amount" => $request->amount,
            "orderId" => $request->orderId,
            "firstName" => $request->billingAddress['firstName'],
            "lastName" => $request->billingAddress['lastName'],
            "address1" => $request->billingAddress['address1'],
            "postalCode" => $request->billingAddress['postalCode'],
            "city" => $request->billingAddress['city'],
            "state" => $request->billingAddress['state'],
            "country" => $request->billingAddress['country'],
            "email" => $request->billingAddress['email'],
            "transactionId" => $request->transactionId,
            "currencyCode" => $request->currencyCode,
        ];

        $validacion = $this->antiFraude($cardObject);

        if (isset($validacion["dataMap"]))
        {
            $responseCode = 1000;
            $responseReason = $validacion["dataMap"]["ACTION_DESCRIPTION"];
            $responseDescription = $validacion["dataMap"]["STATUS"];
            $authorizationCode = $validacion["dataMap"]["AUTHORIZATION_CODE"];
            $hostTransactionId = $validacion["dataMap"]["TRANSACTION_ID"];
            $status = 'Transaccion realizada con exito';
        }
        else
        {
            $responseCode = 9000;
            $responseReason = $validacion["errorMessage"];
            $responseDescription = $validacion["data"]["MESSAGE"];
            $authorizationCode = $validacion["data"]["REASON_CODE"];
            $hostTransactionId = $validacion["data"]["REQUEST_ID"];
            $status = 'La transaccion no pudo ser realizada, vuelva a intentarlo';
        }

        $object = [
            "orderId"           => $request->orderId,
            "currencyCode"      => $request->currencyCode,
            "transactionId"     => $request->transactionId,
            "paymentId"         => $request->paymentId,
            "amount"            => $request->amount,
            "transactionType"   => $request->transactionType,
            "hostTransactionTimestamp"  => $request->transactionTimestamp,
            "transactionTimestamp"      => $request->transactionTimestamp,
            "paymentMethod"             => $request->paymentMethod,
            "gatewayId"                 => $request->gatewayId,
            "siteId"                    => $request->siteId,
            "authorizationResponse" => [
                "responseCode" => $responseCode,
                "responseReason" => $responseReason,
                "responseDescription" =>  $responseDescription,
                "authorizationCode" => $authorizationCode,
                "hostTransactionId" => $hostTransactionId
            ],
            "additionalProperties"=> [
                "Status"=> $status
            ]
        ];
        return $object;
    }

    public function antiFraude($datos)
    {

        $aux = ltrim($datos['amount'], "0");
        $datos['amount'] = substr_replace($aux,".",-2,0);

        $amount = $datos['amount'];
        $datos['orderId'] = substr($datos['orderId'],1);

        $words = explode(" ", $datos['holderName']);

        $first_name = $words[0];
        $last_name = $words[1];

        $token = $this->getApiToken();
        $merchantId = '522591303';
        $baseUrl = "https://apitestenv.vnforapps.com/api.antifraud/v1/antifraud/ecommerce/"."$merchantId";
        $data =
            [
                "channel" => "pasarela",
                "merchantDefineData" => [
                    "MDD5"         => "AFKI345",
                    "MDD93"       => "20187654324"
                ],
                "billingAddress" => [
                    "street1"         => $datos['address1'],
                    "postalCode"  => $datos['postalCode'],
                    "city"  => $datos['city'],
                    "state"  => $datos['state'],
                    "country"  => $datos['country']
                ],
                "order" => [
                    "purchaseNumber"         => $datos['orderId'],
                    "amount"       => $datos['amount'],
                    "currency"  => $datos['currencyCode']
                ],
                "card" => [
                    "cardNumber"         => $datos['cardNumber'],
                    "expirationMonth"       => $datos['expirationMonth'],
                    "expirationYear"  => $datos['expirationYear'],
                    "cvv2"  => $datos['expirationYear']
                ],
                "cardHolder" => [
                    "firstName"         => $first_name,
                    "lastName"       => $last_name,
                    "email"  => $datos['email'],
                ]
            ];
        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
            'Authorization' => $token,
        ])->post($baseUrl, $data);
        if ($response->status() == 200 && isset($response['token']['tokenId'])) {
            $responseObject = [
                "tokenId" => $response['token']['tokenId'],
                "purchaseNumber" => $response['order']['purchaseNumber'],
                "amount" => $response['order']['amount'],
                "currency" => $response['order']['currency']
            ];
            $autorizacion = $this->autorizarTarjeta($responseObject, $merchantId, $token);
            return $autorizacion;
        }
        $jn_antifraude = json_decode(json_encode($response->object()), true);
        return $jn_antifraude;

    }

    public function autorizarTarjeta($object,$merchantId,$token)
    {
        $baseUrl = "https://apitestenv.vnforapps.com/api.authorization/v3/authorization/ecommerce/" . "$merchantId";
        $data =
            [
                "channel" => "pasarela",
                "captureType" => "manual",
                "countable" => "false",
                "order" => [
                    "tokenId" => $object['tokenId'],
                    "purchaseNumber" => $object['purchaseNumber'],
                    "amount" => $object['amount'],
                    "currency" => $object["currency"]
                ]
            ];

        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
            'Authorization' => $token,
        ])->post($baseUrl, $data);

        if (isset($response["order"]["transactionId"]))
        {

            $responseObject = [
                'transactionId' => $response["order"]["transactionId"],
                'amount' => $response["order"]["amount"],
                'currency' => $response["order"]["currency"],
                'purchaseNumber' => $response["order"]["purchaseNumber"]
            ];
            $confirmation = $this->confirmarPago($responseObject, $merchantId, $token);
            return $confirmation;
        }
        else{
        $jn_autorizacion = json_decode(json_encode($response), true);
        return $jn_autorizacion;
        }
    }


    public function confirmarPago($object,$merchant,$token)
    {
        $baseUrl = "https://apitestenv.vnforapps.com/api.confirmation/v1/confirmation/ecommerce/"."$merchant";
        $data =
            [
                "channel" => "pasarela",
                "captureType" => "manual",
                "order" => [
                    "purchaseNumber"         => $object['purchaseNumber'],
                    "amount"       => $object['amount'],
                    "currency"  => "PEN",
                    "transactionId"  => $object['transactionId']
                ]
            ];

        $response = Http::withHeaders([
                'Content-Type' => 'application/json',
                'Authorization' => $token,
            ])->post($baseUrl, $data);

        return $response;

    }
}
