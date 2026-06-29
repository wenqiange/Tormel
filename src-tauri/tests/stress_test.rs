use tormel_pos_lib; // Asumiendo que expone lógica interna o usamos un mock

#[test]
fn test_stress_calculo_huellas() {
    // Simulamos la generación masiva de huellas VeriFactu
    // para asegurar que el algoritmo de Hashing (SHA256) responde rápido
    let mut ultimo_hash = Some("INIT_HASH_000000".to_string());
    
    let iterations = 10_000;
    
    let start = std::time::Instant::now();
    
    for i in 1..=iterations {
        let num_factura = format!("F-{}", i);
        // Función asilada para testear rendimiento puro de hashing encadenado
        let mut huella = format!(
            "B12345678{}29-06-2026F121.00121.00",
            num_factura
        );
        
        if let Some(ref h) = ultimo_hash {
            huella.push_str(h);
        }
        
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(huella.as_bytes());
        let hash_hex = format!("{:X}", hasher.finalize());
        
        ultimo_hash = Some(hash_hex);
    }
    
    let duration = start.elapsed();
    
    // Verificamos que 10.000 hashes encadenados se generen en menos de 1 segundo
    // (Generalmente toma milisegundos en Rust, pero previene regresiones de rendimiento)
    assert!(duration.as_secs() < 1, "Stress test falló: Tomó más de 1 segundo generar 10k huellas");
    
    println!("Stress test completado: 10,000 iteraciones en {:?}", duration);
}
