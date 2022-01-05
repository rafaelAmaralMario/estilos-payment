<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use GuzzleHttp\Client;

class PagoEfectivoController extends Controller
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
        $data = [
            'amount' => $request->amount,
            'email' => $request->billingAddress['email'],
            'firstName' => $request->billingAddress['firstName'],
            'externalTransactionId' => $request->transactionId
        ];
        $aux = ltrim($data['amount'], "0");
        $datos['amount'] = substr_replace($aux,".",-2,0);

        $amount = "".$datos['amount']."";

        $merchantId = '101183542';
        $baseUrl = "https://apitestenv.vnforapps.com/api.pagoefectivo/v1/create/"."$merchantId";
        $token = $this->getApiToken();

        $data =
            [
                "channel" => "pasarela",
                "email" => $data['email'],
                "firstName" => $data['firstName'],
                "amount" => $amount,
                "externalTransactionId" => $data['externalTransactionId']
            ];
        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
            'Authorization' => $token,
        ])->post($baseUrl, $data);

        return $response;
    }


}
