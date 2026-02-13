<?php
use PHPMailer\PHPMailer\PHPMailer;
require '../vendor/autoload.php'; 

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $nombre = $_POST['nombre'] ?? 'Asistente';
    $email = $_POST['email'];
    $modalidad = $_POST['modalidad'];

    $mail = new PHPMailer(true);
    try {
        // Configuración SMTP
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = 'tu-email@gmail.com';
        $mail->Password = 'tu-app-password'; // SMTP PASSWORD
        $mail->SMTPSecure = 'tls';
        $mail->Port = 587;

        $mail->setFrom('registro@congreso.com', 'Congreso Mazatlan');
        $mail->addAddress($email);
        $mail->isHTML(true);
        $mail->Subject = 'Confirmacion de Reservacion';
        $mail->Body = "<h1>¡Hola $nombre!</h1><p>Tu registro para el congreso en modalidad <b>$modalidad</b> está listo.</p>";

        $mail->send();

        // Lógica de redirección
        if ($modalidad === 'linea') {
            header("Location: https://www.paypal.com/pago-en-linea");
        } else {
            header("Location: ../index.php?status=success");
        }
    } catch (Exception $e) {
        echo "Error: {$mail->ErrorInfo}";
    }
}