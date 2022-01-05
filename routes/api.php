<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Middleware\AuthBasic;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

// Route::middleware('auth:api')->get('/user', function (Request $request) {
//     return $request->user();
// });
/*Route::middleware(['guest'])
    ->prefix('v1')
    ->group(function () {
        Route::get('/getApiToken', 'NiubizController@getApiToken');
    });
Route::get('/getApiToken', 'NiubizController@getApiToken');*/

Route::prefix('v1/oracle')->group(function() {
    Route::post('/payment', 'OracleController@payment')->name('oracle.payment');
});
Route::prefix('v1/oracle/pagoefectivo')->group(function() {
    Route::post('/payment', 'PagoEfectivoController@payment')->name('pagoefectivo.payment');
});

Route::prefix('v1/test')->group(function() {
    Route::post('/rafael', 'testController@payment')->name('test.payment');
});
