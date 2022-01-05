<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class testController extends Controller
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
        Log::info('Inicianding process of test');

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

        $aux = ltrim($cardObject['amount'], "0");
        $cardObject['amount'] = substr_replace($aux,".",-2,0);

        $amount = $cardObject['amount'];
        $cardObject['orderId'] = substr($cardObject['orderId'],1);

        $words = explode(" ", $cardObject['holderName']);

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
                    "street1"         => $cardObject['address1'],
                    "postalCode"  => $cardObject['postalCode'],
                    "city"  => $cardObject['city'],
                    "state"  => $cardObject['state'],
                    "country"  => $cardObject['country']
                ],
                "order" => [
                    "purchaseNumber"         => $cardObject['orderId'],
                    "amount"       => $cardObject['amount'],
                    "currency"  => $cardObject['currencyCode']
                ],
                "card" => [
                    "cardNumber"         => $cardObject['cardNumber'],
                    "expirationMonth"       => $cardObject['expirationMonth'],
                    "expirationYear"  => $cardObject['expirationYear'],
                    "cvv2"  => $cardObject['expirationYear']
                ],
                "cardHolder" => [
                    "firstName"         => $first_name,
                    "lastName"       => $last_name,
                    "email"  => $cardObject['email'],
                ]
            ];
        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
            'Authorization' => $token,
        ])->post($baseUrl, $data);

        return $response;
    }
}
