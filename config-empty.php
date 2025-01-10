<?php

// $dbh = new PDO('pgsql:dbname=<database>', '<username>', '<password>');
// $dbh = new PDO('mysql:dbname=<database>', '<username>', '<password>');
// $dbh = new PDO('sqlite:<filename>');
$dbh = new PDO(...);

$lt_settings = [
  'blocks_dir' => 'blocks/',
  'error_rewrite' => [
    "/.*Duplicate entry '(.*)' for key 'username'/" => 'Username "$1" is already present in the database'
  ]
];
