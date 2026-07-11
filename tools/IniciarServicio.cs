using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

internal static class IniciarServicio
{
    private static int Main()
    {
        Console.Title = "Servicio Consultor de Precios";

        string projectDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        Directory.SetCurrentDirectory(projectDir);

        Console.WriteLine("Servicio - Consultor de Precios CompraYa");
        Console.WriteLine("Carpeta: " + projectDir);
        Console.WriteLine();

        string venvPython = Path.Combine(projectDir, ".venv", "Scripts", "python.exe");
        if (!File.Exists(venvPython))
        {
            return Fail("No existe .venv. Ejecuta primero InstalarTodo.exe.");
        }

        if (!File.Exists(Path.Combine(projectDir, ".env")))
        {
            Console.WriteLine("Aviso: no existe .env. La aplicacion usara valores por defecto y puede fallar la conexion SQL.");
        }

        bool hasHttps = File.Exists(Path.Combine(projectDir, "cert.pem")) && File.Exists(Path.Combine(projectDir, "key.pem"));
        string port = hasHttps ? "8443" : "8080";
        string url = (hasHttps ? "https" : "http") + "://localhost:" + port;
        string args = "-m uvicorn app:app --host 0.0.0.0 --port " + port;

        if (hasHttps)
        {
            args += " --ssl-certfile cert.pem --ssl-keyfile key.pem";
        }

        Console.WriteLine("Iniciando servicio en " + url);
        Console.WriteLine("Deja esta ventana abierta mientras uses la aplicacion.");
        Console.WriteLine("Para detener el servicio, presiona Ctrl+C o cierra esta ventana.");
        Console.WriteLine();

        ProcessStartInfo info = new ProcessStartInfo(venvPython, args);
        info.UseShellExecute = false;
        info.RedirectStandardOutput = false;
        info.RedirectStandardError = false;
        info.WorkingDirectory = projectDir;

        using (Process process = Process.Start(info))
        {
            Thread.Sleep(1500);
            OpenBrowser(url);
            process.WaitForExit();
            return process.ExitCode;
        }
    }

    private static void OpenBrowser(string url)
    {
        try
        {
            ProcessStartInfo info = new ProcessStartInfo(url);
            info.UseShellExecute = true;
            Process.Start(info);
        }
        catch
        {
            Console.WriteLine("Abre manualmente: " + url);
        }
    }

    private static int Fail(string message)
    {
        Console.WriteLine();
        Console.WriteLine("ERROR: " + message);
        Console.WriteLine();
        Console.WriteLine("Presiona una tecla para cerrar...");
        Console.ReadKey(true);
        return 1;
    }
}
