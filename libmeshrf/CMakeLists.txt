cmake_minimum_required(VERSION 3.10)
project(meshrf_native)

set(CMAKE_CXX_STANDARD 17)

# ITM Source Files
file(GLOB ITM_SOURCES "vendor/itm/src/*.cpp")

# MeshRF Source Files
set(MESHRF_SOURCES
    src/meshrf_itm.cpp
    src/meshrf_viewshed.cpp
    src/meshrf_coverage.cpp
    src/meshrf_planner.cpp
)

# Include Directories
include_directories(
    include
    vendor/itm/include
)

if(EMSCRIPTEN)
    list(APPEND MESHRF_SOURCES src/bindings.cpp)
    
    # Executable for Wasm (Meshrf.js)
    add_executable(meshrf ${MESHRF_SOURCES} ${ITM_SOURCES})
    
    target_link_options(meshrf PRIVATE
        -lembind
        -sWASM=1
        -sALLOW_MEMORY_GROWTH=1
        -sMODULARIZE=1
        -sEXPORT_ES6=1
        -sEXPORT_NAME=createMeshRF
        -sEXPORTED_FUNCTIONS=['_malloc','_free']
        -sEXPORTED_RUNTIME_METHODS=['HEAPF32','HEAPU8','HEAP32']
        -O3
    )
else()
    # Executable for Native Testing
    add_executable(meshrf_test src/main.cpp ${MESHRF_SOURCES} ${ITM_SOURCES})
endif()
