<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OracleCredential extends Model
{
    protected $table = 'oracle_credentials';
    protected $fillable = ['token'];
}
