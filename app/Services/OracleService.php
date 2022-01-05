<?php

namespace App\Services;

use App\Models\OracleCredential;
use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use \GuzzleHttp\Client;

class OracleService {

  /**
   * ------------------------------------------------------------------------------------------------------------
   * -------------------------------- TOKEN ---------------------------------------------------------------------
   * ------------------------------------------------------------------------------------------------------------
   * updateToken
   * se actualiza o se crea token
   * @param  $token
   * @return void
   */
  public function updateToken($token = null){
    OracleCredential::updateOrCreate(['id'=> 1],['token' => $token]);
  }

  /**
   * lastToken
   * se obtiene el ultimo token de DB
   * @return token
   */
  public function lastToken(){
    $token = $token = OracleCredential::find(1)->token;
    return $token;
  }

  /**
   * getToken
   * se debe utilizar una sola vez para generar el primer token 
   * tener en cuenta tener un totp_code válido antes de llamar al metodo.
   * 
   * @return token|null
   */
  public function getToken()
  {
    try {
      $data = array(
            'grant_type'  => 'password',
            'username'    => env('USER_ORACLE'),
            'password'    => env('PASSWORD_ORACLE'),
            'totp_code'   => env('TOTP_CODE_ORACLE') //codigo obtenido desde app oracle autenticador
      );
    
      $client = new Client();
      $response = $client->request('POST',env('API_ORACLE')."/ccadmin/v1/mfalogin",[
          'form_params' =>$data,
          'headers' => [
              "Content-Type"=>"application/x-www-form-urlencoded"
          ]
      ]);
      $token =collect(json_decode($response->getBody()->getContents()));

      $this->updateToken($token['access_token']);
      
      return $token['access_token'];

    } catch (\Throwable $th) {
    
      Log::channel('oracle')->info($th->getMessage());
    }
  }

  /**
   * getTokenRefresh
   * Actualiza el token 
   * una vez utilizado el @method getToken(), dejar activo el proceso  *php artisan schedule:work* en local 
   * para que se actualice el token cada 4 minutos antes de que se pueda vencer.
   * 
   * @return token|null
   */
  public function getTokenRefresh()
  {
      $token = $this->lastToken();
      //hay que traer el ultimo token para actualizar.
      try {
        $resp = Http::withHeaders([
            "Content-Type"  => "application/json",
            "Authorization" => 'Bearer '. $token
        ])->post(env('API_ORACLE')."/ccadmin/v1/refresh",[
          'refresh_token' => $token
        ]);

        if(isset($resp['access_token'])){

          $newToken = $resp->json();
          $this->updateToken($newToken['access_token']);

          return $newToken['access_token'];

        }else{

          return $token;
          Log::channel('oracle')->info('error al obtener el token'.json_encode(['status'=> $resp['status'],'error' => $resp['message']]));
          
        }
      
      } catch (Exception $e) {
        Log::info('Error al actualizar token:'. json_encode(['error' => $e->getMessage()]));
      }
  }
}