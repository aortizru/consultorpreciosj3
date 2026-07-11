using System;
using System.Diagnostics;
using System.IO;

internal static class InstalarTodo
{
    private static int Main()
    {
        Console.Title = "Instalar Consultor de Precios";

        string projectDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        Directory.SetCurrentDirectory(projectDir);

        Console.WriteLine("Instalador - Consultor de Precios CompraYa");
        Console.WriteLine("Carpeta: " + projectDir);
        Console.WriteLine();

        if (!File.Exists(Path.Combine(projectDir, "requirements.txt")) || !File.Exists(Path.Combine(projectDir, "app.py")))
        {
            return Fail("Este instalador debe ejecutarse desde la carpeta raiz del proyecto.");
        }

        string systemPython = FindPython();
        if (systemPython == null)
        {
            return Fail(
                "No se encontro Python 3.12 en el equipo.\n" +
                "Instala Python 3.12 desde https://www.python.org/downloads/ y marca 'Add python.exe to PATH'."
            );
        }

        string venvPython = Path.Combine(projectDir, ".venv", "Scripts", "python.exe");
        string venvDir = Path.Combine(projectDir, ".venv");

        if (File.Exists(venvPython) && !IsPython312(venvPython))
        {
            Console.WriteLine("El entorno virtual existente no usa Python 3.12.");
            Console.WriteLine("Regenerando .venv para evitar errores instalando pyodbc...");
            try
            {
                Directory.Delete(venvDir, true);
            }
            catch (Exception exc)
            {
                return Fail("No se pudo eliminar .venv. Cierra ventanas que lo esten usando y vuelve a ejecutar el instalador.\nDetalle: " + exc.Message);
            }
        }

        if (!File.Exists(venvPython))
        {
            Console.WriteLine("Creando entorno virtual .venv...");
            int code = Run(systemPython, "-m venv .venv");
            if (code != 0)
            {
                return Fail("No se pudo crear el entorno virtual.");
            }
        }
        else
        {
            Console.WriteLine("Entorno virtual encontrado: .venv");
        }

        Console.WriteLine();
        Console.WriteLine("Actualizando pip...");
        if (Run(venvPython, "-m pip install --upgrade pip") != 0)
        {
            return Fail("No se pudo actualizar pip.");
        }

        Console.WriteLine();
        Console.WriteLine("Instalando dependencias de requirements.txt...");
        if (Run(venvPython, "-m pip install -r requirements.txt") != 0)
        {
            return Fail("No se pudieron instalar las dependencias.");
        }

        string envPath = Path.Combine(projectDir, ".env");
        string envExamplePath = Path.Combine(projectDir, ".env.example");
        if (!File.Exists(envPath) && File.Exists(envExamplePath))
        {
            File.Copy(envExamplePath, envPath);
            Console.WriteLine();
            Console.WriteLine("Se creo .env desde .env.example. Edita ese archivo con la IP o nombre del servidor SQL Server.");
        }

        Console.WriteLine();
        Console.WriteLine("Instalacion terminada.");
        Console.WriteLine("Importante: verifica que este instalado 'ODBC Driver 17 for SQL Server'.");
        Console.WriteLine("Luego ejecuta IniciarServicio.exe para levantar la aplicacion.");
        Pause();
        return 0;
    }

    private static string FindPython()
    {
        string[] commands = new[] { "py -3.12", "python" };
        foreach (string command in commands)
        {
            if (IsPython312(command))
            {
                return command;
            }
        }

        return null;
    }

    private static bool IsPython312(string command)
    {
        string version = GetPythonVersion(command);
        return version.StartsWith("Python 3.12.");
    }

    private static string GetPythonVersion(string command)
    {
        int firstSpace = command.IndexOf(' ');
        string fileName = firstSpace >= 0 ? command.Substring(0, firstSpace) : command;
        string args = firstSpace >= 0 ? command.Substring(firstSpace + 1) + " --version" : "--version";

        try
        {
            ProcessStartInfo info = new ProcessStartInfo(fileName, args);
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;

            using (Process process = Process.Start(info))
            {
                process.WaitForExit(5000);
                string output = process.StandardOutput.ReadToEnd().Trim();
                string error = process.StandardError.ReadToEnd().Trim();
                if (process.ExitCode == 0)
                {
                    return output.Length > 0 ? output : error;
                }
            }
        }
        catch
        {
        }

        return "";
    }

    private static int Run(string command, string arguments)
    {
        int firstSpace = command.IndexOf(' ');
        string fileName = firstSpace >= 0 ? command.Substring(0, firstSpace) : command;
        string commandArgs = firstSpace >= 0 ? command.Substring(firstSpace + 1) + " " + arguments : arguments;

        ProcessStartInfo info = new ProcessStartInfo(fileName, commandArgs);
        info.UseShellExecute = false;
        info.RedirectStandardOutput = false;
        info.RedirectStandardError = false;
        info.WorkingDirectory = Directory.GetCurrentDirectory();

        using (Process process = Process.Start(info))
        {
            process.WaitForExit();
            return process.ExitCode;
        }
    }

    private static int Fail(string message)
    {
        Console.WriteLine();
        Console.WriteLine("ERROR: " + message);
        Pause();
        return 1;
    }

    private static void Pause()
    {
        Console.WriteLine();
        Console.WriteLine("Presiona una tecla para cerrar...");
        Console.ReadKey(true);
    }
}
