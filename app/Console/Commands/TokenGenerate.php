<?php

namespace App\Console\Commands;

use App\Models\OracleCredential;
use App\Services\OracleService;
use Illuminate\Console\Command;

class TokenGenerate extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'oracle:token';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Se actualiza el token cada 10 minutos';

    /**
     * Create a new command instance.
     *
     * @return void
     */
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $now = now()->subMinutes(6);
        $tokenSaved = OracleCredential::first();
        $oracleService = new OracleService();   

        if(is_null($tokenSaved)) {
            $oracleService->getToken();
        } else {
            if($tokenSaved->updated_at < $now) {
                $oracleService->getToken();
            } else {
                $oracleService->getTokenRefresh();
            }
        }
        
    }
}